import { matchDate, matchMoney, modePercent } from '../matchers.js';
import {
  blankStatement,
  type CreditKindCode,
  type ParsedStatement,
} from '../types.js';

export function parseNu(
  text: string,
  kind: CreditKindCode = 'CONSUMO',
): ParsedStatement {
  const parsed = blankStatement('NU', kind, 'Nu');
  const used = matchMoney(text, /Usado\s*(\$[\d.,]+)/i);
  const debtTotal = matchMoney(text, /(\$[\d.,]+)\s*DEUDA TOTAL/i);
  const advances = matchMoney(
    text,
    /Comisiones de avances\s*\+\s*(\$[\d.,]+)/i,
  );
  const service = matchMoney(
    text,
    /Comisiones por servicio\s*\+\s*(\$[\d.,]+)/i,
  );
  const conversion = matchMoney(
    text,
    /Cargos por conversi[oó]n\s*\+\s*(\$[\d.,]+)/i,
  );
  const charges = [advances, service, conversion].filter(
    (value): value is number => value != null,
  );

  const productRefs = [...text.matchAll(/•(?:\s*•){3}\s*(\d{4})/g)].map(
    (match) => match[1] ?? '',
  );

  parsed.productRef = productRefs.filter(Boolean).join('/') || null;
  parsed.creditLimit = matchMoney(text, /cupo definido\s*(\$[\d.,]+)/i);
  parsed.usedAmount = used ?? debtTotal;
  parsed.availableCredit = matchMoney(text, /Disponible\s*(\$[\d.,]+)/i);
  parsed.remainingBalance = parsed.usedAmount;
  parsed.minPayment =
    matchMoney(text, /PAGO MÍNIMO\s+(\$[\d.,]+)/) ??
    matchMoney(text, /Pago mínimo\s*(\$[\d.,]+)/);
  parsed.amountDueThisPeriod = matchMoney(
    text,
    /(\$[\d.,]+)\s*Deuda a pagar este mes/i,
  );
  parsed.installmentAmount =
    matchMoney(text, /Valor a pagar cuota\s*(\$[\d.,]+)/i) ??
    matchMoney(text, /Valor cuota\s*(\$[\d.,]+)/i) ??
    matchMoney(text, /Cuota mensual\s*(\$[\d.,]+)/i);
  if (
    kind === 'CONSUMO' &&
    parsed.installmentAmount == null
  ) {
    parsed.installmentAmount =
      parsed.minPayment ?? parsed.amountDueThisPeriod ?? null;
  }
  parsed.periodInterest = matchMoney(text, /\+\s*(\$[\d.,]+)\s*Intereses\b/i);
  parsed.insuranceOrOtherCharges = charges.length
    ? Math.round(charges.reduce((sum, value) => sum + value, 0) * 100) / 100
    : null;
  parsed.nextPaymentDate = matchDate(
    text,
    /Fecha l[ií]mite de pago\s+(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i,
  );
  parsed.cutoffDate = matchDate(
    text,
    /Fecha de corte\s+(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i,
  );
  parsed.rateMv = modePercent(text, 1, 10);
  parsed.daysPastDue = 0;
  parsed.extras = {
    debtTotal,
  };
  return parsed;
}
