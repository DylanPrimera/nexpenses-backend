import { createHash } from 'node:crypto';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentType } from '@prisma/client';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser';
import { CategoriesService } from '../categories/categories.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { extractInboundUserId } from './extract-inbound-user-id.js';
import { parseBankNotice } from './parse-bank-notice.js';

export type EmailInboundSkipReason =
  | 'empty_source'
  | 'no_message_id'
  | 'already_processed'
  | 'user_mismatch'
  | 'empty_body'
  | 'no_amount'
  | 'duplicate_fingerprint';

export type EmailInboundSyncResult = {
  created: number;
  skipped: number;
  deleted: number;
  errors: string[];
  skippedByReason: Partial<Record<EmailInboundSkipReason, number>>;
};

type ProcessOutcome =
  | { status: 'created' }
  | { status: 'skipped'; reason: EmailInboundSkipReason };

type ImapConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  deleteAfterMs: number;
};

function addressText(value: AddressObject | AddressObject[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of list) {
    if (item.text) out.push(item.text);
    for (const addr of item.value ?? []) {
      if (addr.address) out.push(addr.address);
    }
  }
  return out;
}

function headerString(
  headers: ParsedMail['headers'],
  name: string,
): string | string[] | null {
  const raw = headers.get(name);
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'object' && raw !== null && 'text' in raw) {
    return String((raw as { text?: string }).text ?? raw);
  }
  return String(raw);
}


function asUidList(value: number[] | false | undefined | null): number[] {
  return Array.isArray(value) ? value : [];
}

function normalizeMessageId(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(/^<|>$/g, '');
}

function bodyText(parsed: ParsedMail): string {
  const text = parsed.text?.trim();
  if (text) return text;
  const html = parsed.html;
  if (typeof html === 'string' && html.trim()) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}


function buildTransactionFingerprint(input: {
  reference: string | null;
  inReplyTo: string | null | undefined;
  amount: number;
  merchant: string | null;
  snippet: string;
}): string {
  if (input.reference?.trim()) {
    return `ref:${input.reference.trim().toLowerCase()}`;
  }
  const origin = normalizeMessageId(input.inReplyTo ?? null);
  if (origin) {
    return `origin:${origin.toLowerCase()}`;
  }
  const basis = [
    String(input.amount),
    (input.merchant ?? '').trim().toLowerCase(),
    (input.snippet ?? '').trim().toLowerCase(),
  ].join('|');
  const hash = createHash('sha256').update(basis).digest('hex').slice(0, 32);
  return `content:${hash}`;
}

@Injectable()
export class EmailInboundService {
  private readonly logger = new Logger(EmailInboundService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly expensesService: ExpensesService,
    private readonly categoriesService: CategoriesService,
  ) {}

  private resolveImapConfig(): ImapConfig {
    const host = this.config.get<string>('IMAP_HOST')?.trim() || 'imap.gmail.com';
    const port = Number(this.config.get<string>('IMAP_PORT') ?? 993);
    const user =
      this.config.get<string>('IMAP_USER')?.trim() || 'nexpensesdev@gmail.com';
    const pass = this.config.get<string>('IMAP_APP_PASSWORD')?.trim() ?? '';
    const deleteAfterMs = Number(
      this.config.get<string>('EMAIL_INBOUND_DELETE_AFTER_MS') ?? 3_600_000,
    );

    if (!pass) {
      throw new ServiceUnavailableException(
        'IMAP_APP_PASSWORD no está configurado en el servidor',
      );
    }

    return {
      host,
      port: Number.isFinite(port) ? port : 993,
      user,
      pass,
      deleteAfterMs: Number.isFinite(deleteAfterMs) ? deleteAfterMs : 3_600_000,
    };
  }

  private createClient(cfg: ImapConfig): ImapFlow {
    return new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: true,
      auth: { user: cfg.user, pass: cfg.pass },
      logger: false,
    });
  }

  async syncForUser(userId: string): Promise<EmailInboundSyncResult> {
    const result: EmailInboundSyncResult = {
      created: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
      skippedByReason: {},
    };

    const cfg = this.resolveImapConfig();
    const client = this.createClient(cfg);

    try {
      await client.connect();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'No se pudo conectar a IMAP';
      this.logger.error(`IMAP connect failed: ${msg}`);
      throw new ServiceUnavailableException(`IMAP: ${msg}`);
    }

    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        result.deleted = await this.cleanupOldProcessed(
          client,
          userId,
          cfg.deleteAfterMs,
        );

        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const uids = asUidList(await client.search({ since }, { uid: true }));
        if (uids.length === 0) {
          return result;
        }


        for await (const msg of client.fetch(
          uids,
          { source: true, envelope: true },
          { uid: true },
        )) {
          try {
            const outcome = await this.processMessage(userId, msg.source, msg.uid);
            if (outcome.status === 'created') {
              result.created += 1;
            } else {
              result.skipped += 1;
              result.skippedByReason[outcome.reason] =
                (result.skippedByReason[outcome.reason] ?? 0) + 1;
              this.logger.warn(
                `Omitido ${outcome.reason} uid=${msg.uid} mid=${msg.envelope?.messageId ?? 'n/a'}`,
              );
            }
          } catch (error) {
            const detail =
              error instanceof Error ? error.message : String(error);
            const mid = msg.envelope?.messageId ?? `uid:${msg.uid}`;
            result.errors.push(`${mid}: ${detail}`);
            this.logger.warn(`Fallo procesando ${mid}: ${detail}`);
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      try {
        await client.logout();
      } catch {
        client.close();
      }
    }

    return result;
  }

  private async processMessage(
    userId: string,
    source: Buffer | undefined,
    _uid: number,
  ): Promise<ProcessOutcome> {
    if (!source) return { status: 'skipped', reason: 'empty_source' };

    const parsed = await simpleParser(source);
    const messageId = normalizeMessageId(parsed.messageId);
    if (!messageId) return { status: 'skipped', reason: 'no_message_id' };

    const already = await this.prisma.processedInboundEmail.findUnique({
      where: { messageId },
    });
    if (already) return { status: 'skipped', reason: 'already_processed' };

    const inboundUserId = extractInboundUserId({
      to: addressText(parsed.to),
      deliveredTo: headerString(parsed.headers, 'delivered-to'),
      xOriginalTo: headerString(parsed.headers, 'x-original-to'),
      xForwardedTo: headerString(parsed.headers, 'x-forwarded-to'),
      subject: parsed.subject,
    });

    if (!inboundUserId || inboundUserId !== userId.toLowerCase()) {
      return { status: 'skipped', reason: 'user_mismatch' };
    }

    const raw = bodyText(parsed);
    if (!raw) return { status: 'skipped', reason: 'empty_body' };

    const notice = parseBankNotice(raw);
    if (notice.amount == null || notice.amount < 1) {
      // Sin monto: no crear ni borrar; se reintentará en sync futuros.
      return { status: 'skipped', reason: 'no_amount' };
    }

    const fingerprint = buildTransactionFingerprint({
      reference: notice.reference,
      inReplyTo: parsed.inReplyTo,
      amount: notice.amount,
      merchant: notice.merchant,
      snippet: notice.snippet,
    });

    const duplicate = await this.prisma.processedInboundEmail.findFirst({
      where: { userId, fingerprint },
      orderBy: { processedAt: 'asc' },
    });
    if (duplicate) {
      // Mismo aviso reenviado otra vez: marcar este Message-ID y no crear otro gasto.
      await this.prisma.processedInboundEmail.create({
        data: {
          messageId,
          fingerprint,
          userId,
          expenseId: duplicate.expenseId,
        },
      });
      return { status: 'skipped', reason: 'duplicate_fingerprint' };
    }

    const categorySeed =
      (notice.merchant?.trim() || notice.snippet?.trim() || 'correo').slice(0, 80);
    const category = await this.categoriesService.getOrCreate(userId, {
      name: categorySeed,
    });

    const title = (
      notice.merchant?.trim() ||
      notice.snippet?.trim() ||
      'Gasto por correo'
    ).slice(0, 80);
    const description = (
      notice.snippet?.trim() ||
      notice.merchant?.trim() ||
      'Gasto por correo'
    ).slice(0, 100);

    const paymentType =
      notice.paymentType === 'credit_card'
        ? PaymentType.credit_card
        : PaymentType.debit_card;

    const expense = await this.expensesService.create(userId, {
      amount: notice.amount,
      categoryId: category.id,
      title,
      description,
      paymentType,
      date: parsed.date ? parsed.date.toISOString() : undefined,
    });

    await this.prisma.processedInboundEmail.create({
      data: {
        messageId,
        fingerprint,
        userId,
        expenseId: expense.id,
      },
    });

    return { status: 'created' };
  }

  /** Borra del buzón mails ya procesados hace más de deleteAfterMs. */
  private async cleanupOldProcessed(
    client: ImapFlow,
    userId: string,
    deleteAfterMs: number,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - deleteAfterMs);
    const old = await this.prisma.processedInboundEmail.findMany({
      where: { userId, processedAt: { lte: cutoff } },
      select: { messageId: true },
      take: 200,
    });

    if (old.length === 0) return 0;

    let deleted = 0;
    const uidsToDelete: number[] = [];

    for (const row of old) {
      try {
        let uids = asUidList(
          await client.search(
            { header: { 'message-id': row.messageId } },
            { uid: true },
          ),
        );
        if (uids.length === 0) {
          uids = asUidList(
            await client.search(
              { header: { 'message-id': `<${row.messageId}>` } },
              { uid: true },
            ),
          );
        }
        for (const uid of uids) uidsToDelete.push(uid);
      } catch (error) {
        this.logger.warn(
          `Cleanup search falló para ${row.messageId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const unique = [...new Set(uidsToDelete)];
    if (unique.length > 0) {
      try {
        await client.messageDelete(unique, { uid: true });
        deleted = unique.length;
      } catch (error) {
        this.logger.warn(
          `messageDelete falló: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return deleted;
  }
}
