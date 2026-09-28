import { parseRate } from '../../domain/money.js';
import { foldText } from '../detect-provider.js';
import { matchDate, matchMoney, matchRate } from '../matchers.js';
import {
  blankStatement,
  type CreditKindCode,
  type ParsedStatement,
} from '../types.js';

function scrub(text: string): string {
  return text.replace(/saldo\s+vencido/gi, 'saldo_vencido');
}

function firstMoney(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const value = matchMoney(text, pattern);
    if (value != null) return value;
  }
  return null;
}

function firstDate(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const value = matchDate(text, pattern);
    if (value) return value;
  }
  return null;
}

export function parseGeneric(
  text: string,
  kind: CreditKindCode,
): ParsedStatement {
  const folded = foldText(text);
  let bankName = 'Otro';
  if (folded.includes('banco de bogota')) bankName = 'Banco de Bogotá';
  else if (folded.includes('bancolombia')) bankName = 'Bancolombia';
  else if (folded.includes('davivienda')) bankName = 'Davivienda';

  const parsed = blankStatement('GENERIC', kind, bankName);
  const source = scrub(text);

  parsed.remainingBalance = firstMoney(source, [
    /saldo total(?: a la fecha)?\s*[:\s]*(\$[\d.,]+)/i,
    /saldo a la fecha(?: de corte)?[\s\S]{0,80}?(\$[\d.,]+)/i,
    /saldo a capital\s*[:\s]*(\$[\d.,]+)/i,
    /deuda total[\s\S]{0,40}?(\$[\d.,]+)/i,
    /(\$[\d.,]+)\s*deuda total/i,
    /saldo\s*[:\s]*(\$[\d.,]+)/i,
  ]);
  parsed.nextPaymentDate = firstDate(source, [
    /fecha\s+l[ií]mite\s+de\s+pago\s*[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /fecha\s+l[ií]mite\s+de\s+pago\s*[:\s]*(\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóúñ.]+\s+\d{4})/i,
    /l[ií]mite\s+de\s+pago\s*:\s*([A-Za-zÁÉÍÓÚáéíóúñ.]+\s*\d{1,2},?\s*\d{4})/i,
    /pague\s+hasta\s*[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /fecha\s+de\s+pago\s*[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ]);
  parsed.cutoffDate = firstDate(source, [
    /fecha\s+de\s+corte\s*[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /fecha\s+de\s+corte\s*[:\s]*(\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóúñ.]+\s+\d{4})/i,
    /fecha\s+corte\s*[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ]);
  parsed.minPayment = firstMoney(source, [
    /pago\s+m[ií]nimo\s*[:\s]*(\$[\d.,]+)/i,
  ]);
  parsed.installmentAmount = firstMoney(source, [
    /valor\s+a\s+pagar\s+cuota\s*[:\s]*(\$[\d.,]+)/i,
    /valor\s+cuota\s*[:\s]*(\$[\d.,]+)/i,
    /cuota\s+mensual\s*[:\s]*(\$[\d.,]+)/i,
  ]);
  parsed.creditLimit = firstMoney(source, [
    /cupo(?:\s+definido|\s+total)?\s*[:\s]*(\$[\d.,]+)/i,
  ]);
  parsed.availableCredit = firstMoney(source, [
    /disponible\s*[:\s]*(\$[\d.,]+)/i,
  ]);
  parsed.usedAmount = firstMoney(source, [/usado\s*[:\s]*(\$[\d.,]+)/i]);
  parsed.periodInterest = firstMoney(source, [
    /intereses?\s+corrientes\s*[:\s]*(\$[\d.,]+)/i,
    /intereses?\s*[:\s]*(\$[\d.,]+)/i,
  ]);
  parsed.originalAmount = firstMoney(source, [
    /monto\s+solicitado\s*[:\s]*(\$[\d.,]+)/i,
    /valor\s+aprobado\s*[:\s]*(\$[\d.,]+)/i,
  ]);

  const mv = matchRate(
    source,
    /(?:tasa\s+)?mes\s+vencido\s*[:\s]*([\d.,]+)\s*%/i,
  );
  const ea = matchRate(source, /efectiva\s+anual\s*[:\s]*([\d.,]+)\s*%/i);
  if (mv != null && mv > 8) {
    parsed.rateMv = Math.round((mv / 12) * 10000) / 10000;
    parsed.extras.namv = mv;
  } else {
    parsed.rateMv = mv;
  }
  parsed.rateEa = ea;

  const mora = source.match(/d[ií]as\s+de\s+mora\s*[:\s]*(\d+)/i);
  if (mora?.[1]) parsed.daysPastDue = Number(mora[1]);

  if (
    kind === 'TC' &&
    parsed.remainingBalance == null &&
    parsed.usedAmount != null
  ) {
    parsed.remainingBalance = parsed.usedAmount;
  }

  const rawMv = source.match(/([\d.,]+)\s*%\s*m\.?\s*v/i)?.[1];
  if (parsed.rateMv == null && rawMv) {
    const rate = parseRate(rawMv);
    if (rate != null)
      parsed.rateMv = rate > 8 ? Math.round((rate / 12) * 10000) / 10000 : rate;
  }

  return parsed;
}
