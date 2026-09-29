import { clip, matchDate, matchMoney, matchRate } from '../matchers.js';
import {
  blankStatement,
  type CreditKindCode,
  type ParsedStatement,
} from '../types.js';

export function parseLuloConsumo(
  text: string,
  kind: CreditKindCode = 'CONSUMO',
): ParsedStatement {
  const parsed = blankStatement('LULO', kind, 'Lulo bank');
  const cuota = text.match(/(\d{8,})\s+(\d{1,3})\s+de\s+(\d{1,3})/i);

  parsed.productRef = cuota?.[1] ?? null;
  parsed.installmentCurrent = cuota ? Number(cuota[2]) : null;
  parsed.installmentTotal = cuota ? Number(cuota[3]) : null;
  parsed.termMonths = parsed.installmentTotal;
  parsed.cutoffDate = matchDate(
    text,
    /\d{1,3}\s+de\s+\d{1,3}\s+([A-Za-zÁÉÍÓÚáéíóúñ]+\s+\d{1,2}\s*-\s*\d{4})/i,
  );
  parsed.nextPaymentDate = matchDate(
    text,
    /L[ií]mite de pago:\s*([A-Za-z.]+\s*\d{1,2},?\s*\d{4})/i,
  );
  parsed.installmentAmount = matchMoney(
    text,
    /Valor a pagar cuota\s*(\$[\d.,]+)/i,
  );
  parsed.periodInterest = matchMoney(
    text,
    /Intereses corrientes\s*(\$[\d.,]+)/i,
  );
  parsed.insuranceOrOtherCharges = matchMoney(text, /Seguro\s*(\$[\d.,]+)/i);
  parsed.remainingBalance = matchMoney(
    text,
    /Saldo total a la fecha\s*(\$[\d.,]+)/i,
  );
  parsed.originalAmount = matchMoney(text, /Monto solicitado\s*(\$[\d.,]+)/i);
  parsed.rateEa = matchRate(
    text,
    /Tasa de inter[eé]s efectiva anual\s*([\d.,]+)\s*%/i,
  );
  parsed.installmentType = clip(
    text.match(/Tipo de cuota\s+([^\n]+)/i)?.[1],
    80,
  );
  parsed.daysPastDue = /estado:\s*en mora/i.test(text) ? 1 : 0;
  const moraDays = text.match(/estado:\s*en mora[^\d]{0,20}(\d+)\s*d[ií]as/i);
  if (moraDays?.[1]) parsed.daysPastDue = Number(moraDays[1]);

  const capital = matchMoney(text, /Capital\s*(\$[\d.,]+)/i);
  parsed.extras = { capital };
  return parsed;
}
