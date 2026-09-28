import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreditKind, Prisma } from '@prisma/client';
import { num } from './domain/money.js';
import { projectFromRates } from './domain/projection.js';
import { resolveRates } from './domain/rates.js';
import { MAX_CREDITS_PER_USER } from './constants.js';
import type {
  CreateCreditDto,
  FilterCreditsDto,
  FromStatementDto,
  UpdateCreditDto,
} from './dto/index.js';
import {
  parseCreditStatement,
  StatementParseError,
} from './parsers/parse-statement.js';
import type { ParsedStatement } from './parsers/types.js';
import {
  asJsonObject,
  isoToDate,
  moneyDec,
  rateDec,
  serializeCredit,
  type CreditView,
} from './serialize.js';
import {
  StatementFileService,
  type UploadedPdf,
} from './statement-file.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statementFiles: StatementFileService,
  ) {}

  async create(userId: string, dto: CreateCreditDto, now = new Date()) {
    this.assertPaymentField(dto.kind, dto.minPayment, dto.installmentAmount);
    await this.assertCapacity(userId);

    const rates = resolveRates(
      { rateEa: null, rateMv: null },
      { rateEa: dto.rateEa ?? null, rateMv: dto.rateMv ?? null },
    );
    let periodInterest = dto.periodInterest ?? null;
    if (periodInterest == null && (dto.rateEa != null || dto.rateMv != null)) {
      periodInterest = projectFromRates(
        this.projectionInput({
          kind: dto.kind,
          remainingBalance: dto.remainingBalance,
          originalAmount: dto.originalAmount ?? null,
          termMonths: dto.termMonths ?? null,
          installmentTotal: dto.installmentTotal ?? null,
          installmentCurrent: dto.installmentCurrent ?? null,
          installmentAmount: dto.installmentAmount ?? null,
          insuranceOrOtherCharges: dto.insuranceOrOtherCharges ?? null,
          rateEa: rates.rateEa,
          rateMv: rates.rateMv,
        }),
        {},
        { recomputeBalance: false },
      ).periodInterest;
    }

    const credit = await this.prisma.credit.create({
      data: this.toCreateData(userId, dto, {
        rateEa: rates.rateEa,
        rateMv: rates.rateMv,
        periodInterest,
        rawExtract: { source: 'manual' },
      }),
    });
    return serializeCredit(credit, now);
  }

  async createFromStatement(
    userId: string,
    dto: FromStatementDto,
    file: UploadedPdf | undefined,
    now = new Date(),
  ) {
    await this.assertCapacity(userId);
    const text = await this.statementFiles.consume(file);

    let parsed: ParsedStatement;
    try {
      parsed = parseCreditStatement(text, dto.kind);
    } catch (error) {
      if (error instanceof StatementParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const bankName = dto.bankName?.trim() || parsed.bankName;
    const displayName = dto.displayName?.trim() || bankName;
    const ratesOverridden = dto.rateEa != null || dto.rateMv != null;
    const projected = projectFromRates(
      {
        kind: parsed.kind,
        remainingBalance: parsed.remainingBalance ?? 0,
        originalAmount: parsed.originalAmount,
        termMonths: parsed.termMonths,
        installmentTotal: parsed.installmentTotal,
        installmentCurrent: parsed.installmentCurrent,
        installmentAmount: parsed.installmentAmount,
        insuranceOrOtherCharges: parsed.insuranceOrOtherCharges,
        rateEa: parsed.rateEa,
        rateMv: parsed.rateMv,
      },
      ratesOverridden
        ? { rateEa: dto.rateEa ?? null, rateMv: dto.rateMv ?? null }
        : {},
      { recomputeBalance: false },
    );

    const statement = {
      ...parsed,
      bankName,
      displayName,
      rateEa: ratesOverridden ? projected.rateEa : parsed.rateEa,
      rateMv: ratesOverridden ? projected.rateMv : parsed.rateMv,
      periodInterest: ratesOverridden
        ? projected.periodInterest
        : parsed.periodInterest,
      remainingBalance: parsed.remainingBalance,
      installmentAmount: parsed.installmentAmount,
    };

    const credit = await this.prisma.credit.create({
      data: {
        userId,
        kind: statement.kind,
        provider: statement.provider,
        bankName,
        displayName,
        productRef: statement.productRef,
        cutoffDate: isoToDate(statement.cutoffDate),
        nextPaymentDate: isoToDate(statement.nextPaymentDate),
        daysPastDue: statement.daysPastDue,
        remainingBalance: moneyDec(statement.remainingBalance)!,
        periodInterest: moneyDec(statement.periodInterest),
        insuranceOrOtherCharges: moneyDec(statement.insuranceOrOtherCharges),
        rateEa: rateDec(statement.rateEa),
        rateMv: rateDec(statement.rateMv),
        creditLimit: moneyDec(statement.creditLimit),
        availableCredit: moneyDec(statement.availableCredit),
        usedAmount: moneyDec(statement.usedAmount),
        minPayment: moneyDec(statement.minPayment),
        amountDueThisPeriod: moneyDec(statement.amountDueThisPeriod),
        installmentAmount: moneyDec(statement.installmentAmount),
        installmentCurrent: statement.installmentCurrent,
        installmentTotal: statement.installmentTotal,
        originalAmount: moneyDec(statement.originalAmount),
        termMonths: statement.termMonths,
        installmentType: statement.installmentType,
        stage: statement.stage,
        rawExtract: JSON.parse(
          JSON.stringify({
            source: 'statement',
            provider: statement.provider,
            statement: this.snapshot(statement),
            extras: statement.extras,
          }),
        ) as Prisma.InputJsonValue,
      },
    });

    return serializeCredit(credit, now);
  }

  async findAll(userId: string, filters: FilterCreditsDto, now = new Date()) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const where: Prisma.CreditWhereInput = { userId };
    if (filters.kind) where.kind = filters.kind;

    const [data, total] = await Promise.all([
      this.prisma.credit.findMany({
        where,
        orderBy: { nextPaymentDate: { sort: 'asc', nulls: 'last' } },
        take: limit,
        skip: offset,
      }),
      this.prisma.credit.count({ where }),
    ]);

    return {
      items: data.map((credit) => serializeCredit(credit, now)),
      total,
      limit,
      offset,
    };
  }

  async findOne(
    userId: string,
    id: string,
    now = new Date(),
  ): Promise<CreditView> {
    const credit = await this.prisma.credit.findFirst({
      where: { id, userId },
    });
    if (!credit) throw new NotFoundException('Crédito no encontrado');
    return serializeCredit(credit, now);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCreditDto,
    now = new Date(),
  ) {
    const existing = await this.prisma.credit.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Crédito no encontrado');

    const kind = dto.kind ?? existing.kind;
    const minPayment =
      dto.minPayment !== undefined ? dto.minPayment : num(existing.minPayment);
    const installmentAmount =
      dto.installmentAmount !== undefined
        ? dto.installmentAmount
        : num(existing.installmentAmount);
    this.assertPaymentField(kind, minPayment, installmentAmount);

    const ratesTouched = dto.rateEa !== undefined || dto.rateMv !== undefined;
    let remainingBalance =
      dto.remainingBalance ?? num(existing.remainingBalance) ?? 0;
    let periodInterest =
      dto.periodInterest !== undefined
        ? dto.periodInterest
        : num(existing.periodInterest);
    let nextInstallment = installmentAmount;
    let rateEa = dto.rateEa !== undefined ? dto.rateEa : num(existing.rateEa);
    let rateMv = dto.rateMv !== undefined ? dto.rateMv : num(existing.rateMv);
    const originalAmount =
      dto.originalAmount !== undefined
        ? dto.originalAmount
        : num(existing.originalAmount);
    const termMonths =
      dto.termMonths !== undefined ? dto.termMonths : existing.termMonths;
    const installmentTotal =
      dto.installmentTotal !== undefined
        ? dto.installmentTotal
        : existing.installmentTotal;
    const installmentCurrent =
      dto.installmentCurrent !== undefined
        ? dto.installmentCurrent
        : existing.installmentCurrent;
    const insurance =
      dto.insuranceOrOtherCharges !== undefined
        ? dto.insuranceOrOtherCharges
        : num(existing.insuranceOrOtherCharges);

    let rawExtract = existing.rawExtract as Prisma.InputJsonValue;
    if (ratesTouched) {
      const projected = projectFromRates(
        {
          kind,
          remainingBalance,
          originalAmount,
          termMonths,
          installmentTotal,
          installmentCurrent,
          installmentAmount: nextInstallment,
          insuranceOrOtherCharges: insurance,
          rateEa: num(existing.rateEa),
          rateMv: num(existing.rateMv),
        },
        { rateEa: dto.rateEa ?? null, rateMv: dto.rateMv ?? null },
        { recomputeBalance: true },
      );
      remainingBalance = projected.remainingBalance;
      periodInterest = projected.periodInterest;
      nextInstallment = projected.installmentAmount;
      rateEa = projected.rateEa;
      rateMv = projected.rateMv;
      rawExtract = {
        ...asJsonObject(existing.rawExtract),
        rateProjection: {
          rateEa,
          rateMv,
          remainingBalance,
          periodInterest,
          installmentAmount: nextInstallment,
          at: now.toISOString(),
        },
      };
    }

    const credit = await this.prisma.credit.update({
      where: { id },
      data: {
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.bankName !== undefined
          ? { bankName: dto.bankName.trim() }
          : {}),
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName.trim() }
          : {}),
        ...(dto.productRef !== undefined ? { productRef: dto.productRef } : {}),
        ...(dto.cutoffDate !== undefined
          ? { cutoffDate: isoToDate(dto.cutoffDate) }
          : {}),
        ...(dto.nextPaymentDate !== undefined
          ? { nextPaymentDate: isoToDate(dto.nextPaymentDate) }
          : {}),
        ...(dto.daysPastDue !== undefined
          ? { daysPastDue: dto.daysPastDue }
          : {}),
        ...(dto.creditLimit !== undefined
          ? { creditLimit: moneyDec(dto.creditLimit) }
          : {}),
        ...(dto.availableCredit !== undefined
          ? { availableCredit: moneyDec(dto.availableCredit) }
          : {}),
        ...(dto.usedAmount !== undefined
          ? { usedAmount: moneyDec(dto.usedAmount) }
          : {}),
        ...(dto.minPayment !== undefined
          ? { minPayment: moneyDec(dto.minPayment) }
          : {}),
        ...(dto.amountDueThisPeriod !== undefined
          ? { amountDueThisPeriod: moneyDec(dto.amountDueThisPeriod) }
          : {}),
        ...(dto.installmentType !== undefined
          ? { installmentType: dto.installmentType }
          : {}),
        ...(dto.stage !== undefined ? { stage: dto.stage } : {}),
        ...(dto.installmentCurrent !== undefined
          ? { installmentCurrent: dto.installmentCurrent }
          : {}),
        ...(dto.installmentTotal !== undefined
          ? { installmentTotal: dto.installmentTotal }
          : {}),
        ...(dto.originalAmount !== undefined
          ? { originalAmount: moneyDec(dto.originalAmount) }
          : {}),
        ...(dto.termMonths !== undefined ? { termMonths: dto.termMonths } : {}),
        ...(dto.insuranceOrOtherCharges !== undefined
          ? { insuranceOrOtherCharges: moneyDec(dto.insuranceOrOtherCharges) }
          : {}),
        remainingBalance: moneyDec(remainingBalance)!,
        periodInterest: moneyDec(periodInterest),
        installmentAmount: moneyDec(nextInstallment),
        rateEa: rateDec(rateEa),
        rateMv: rateDec(rateMv),
        ...(ratesTouched ? { rawExtract } : {}),
      },
    });

    return serializeCredit(credit, now);
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.credit.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async assertCapacity(userId: string) {
    const count = await this.prisma.credit.count({ where: { userId } });
    if (count >= MAX_CREDITS_PER_USER) {
      throw new BadRequestException('Puedes registrar máximo 10 créditos');
    }
  }

  private assertPaymentField(
    kind: CreditKind,
    minPayment: number | null | undefined,
    installmentAmount: number | null | undefined,
  ) {
    if (minPayment == null && installmentAmount == null) {
      throw new BadRequestException(
        kind === CreditKind.TC
          ? 'Indica el pago mínimo'
          : 'Indica el valor de la cuota o el pago mínimo',
      );
    }
  }

  private projectionInput(input: {
    kind: CreditKind;
    remainingBalance: number;
    originalAmount: number | null;
    termMonths: number | null;
    installmentTotal: number | null;
    installmentCurrent: number | null;
    installmentAmount: number | null;
    insuranceOrOtherCharges: number | null;
    rateEa: number | null;
    rateMv: number | null;
  }) {
    return input;
  }

  private snapshot(parsed: ParsedStatement): Prisma.InputJsonObject {
    const { extras: _extras, ...rest } = parsed;
    return JSON.parse(JSON.stringify(rest)) as Prisma.InputJsonObject;
  }

  private toCreateData(
    userId: string,
    dto: CreateCreditDto,
    computed: {
      rateEa: number | null;
      rateMv: number | null;
      periodInterest: number | null;
      rawExtract: Prisma.InputJsonValue;
    },
  ): Prisma.CreditUncheckedCreateInput {
    return {
      userId,
      kind: dto.kind,
      provider: dto.provider,
      bankName: dto.bankName.trim(),
      displayName: dto.displayName.trim(),
      productRef: dto.productRef?.trim() || null,
      cutoffDate: isoToDate(dto.cutoffDate),
      nextPaymentDate: isoToDate(dto.nextPaymentDate),
      daysPastDue: dto.daysPastDue ?? 0,
      remainingBalance: moneyDec(dto.remainingBalance)!,
      periodInterest: moneyDec(computed.periodInterest),
      insuranceOrOtherCharges: moneyDec(dto.insuranceOrOtherCharges),
      rateEa: rateDec(computed.rateEa),
      rateMv: rateDec(computed.rateMv),
      creditLimit: moneyDec(dto.creditLimit),
      availableCredit: moneyDec(dto.availableCredit),
      usedAmount: moneyDec(dto.usedAmount),
      minPayment: moneyDec(dto.minPayment),
      amountDueThisPeriod: moneyDec(dto.amountDueThisPeriod),
      installmentAmount: moneyDec(dto.installmentAmount),
      installmentCurrent: dto.installmentCurrent ?? null,
      installmentTotal: dto.installmentTotal ?? null,
      originalAmount: moneyDec(dto.originalAmount),
      termMonths: dto.termMonths ?? null,
      installmentType: dto.installmentType ?? null,
      stage: dto.stage ?? null,
      rawExtract: computed.rawExtract,
    };
  }
}
