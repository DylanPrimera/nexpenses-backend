import { matchDate, matchMoney, matchRate } from '../matchers.js';
import { blankStatement, type ParsedStatement } from '../types.js';

export function parseIcetex(text: string): ParsedStatement {
  const parsed = blankStatement('ICETEX', 'CONSUMO', 'ICETEX');
  const header = text.match(
    /\$[\d.,]+\s+(\$[\d.,]+)\s+(\$[\d.,]+)\s+(\d{2}-\d{2}-\d{2})\s+(\d+)\s+([A-ZÁÉÍÓÚÑ]+)/i,
  );
  const cuotas = text.match(
    /vencido\s+[\d.,]+\s*%\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i,
  );
  const capital = text.match(
    /Capital\s+(\$[\d.,]+)\s+(\$[\d.,]+)\s+(\$[\d.,]+)/i,
  );
  const interest = text.match(
    /Corrientes\s+(\$[\d.,]+)\s+(\$[\d.,]+)\s+(\$[\d.,]+)/i,
  );
  const otros = text.match(/Otros\s+(\$[\d.,]+)\s+(\$[\d.,]+)\s+(\$[\d.,]+)/i);
  const total = matchMoney(text, /Total\s+(\$[\d.,]+)/i);

  const pactadas = cuotas ? Number(cuotas[1]) : null;
  const pagadas = cuotas ? Number(cuotas[2]) : null;
  const pendientes = cuotas ? Number(cuotas[4]) : null;

  parsed.productRef =
    text.match(/Referencia de Pago\s*(\d{6,}-\d)/i)?.[1] ?? null;
  parsed.minPayment = header?.[2] ? matchMoney(header[2], /(\$[\d.,]+)/) : null;
  parsed.installmentAmount = parsed.minPayment;
  parsed.nextPaymentDate = header?.[3] ? matchDate(header[3], /(.+)/) : null;
  parsed.daysPastDue = header?.[4] ? Number(header[4]) : 0;
  parsed.stage = header?.[5] ?? null;
  parsed.cutoffDate = matchDate(text, /Fecha corte\s+(\d{2}-\d{2}-\d{2})/i);
  parsed.installmentTotal = pactadas;
  parsed.termMonths = pactadas;
  parsed.installmentCurrent =
    pactadas == null || pagadas == null
      ? null
      : pagadas + (pendientes && pendientes > 0 ? 1 : 0);
  parsed.remainingBalance = total;
  parsed.periodInterest = interest?.[3]
    ? matchMoney(interest[3], /(\$[\d.,]+)/)
    : null;
  parsed.insuranceOrOtherCharges = otros?.[3]
    ? matchMoney(otros[3], /(\$[\d.,]+)/)
    : null;
  parsed.rateMv = matchRate(text, /Tasa mes\s*vencido\s+([\d.,]+)\s*%/i);
  parsed.originalAmount = null;
  const namv = matchRate(text, /N\.A\.M\.V\s*([\d.,]+)\s*%/i);
  parsed.extras = {
    capital: capital?.[1] ? matchMoney(capital[1], /(\$[\d.,]+)/) : null,
    namv,
    cargosDelMes: header?.[1] ? matchMoney(header[1], /(\$[\d.,]+)/) : null,
    cuotasPagadas: pagadas,
    cuotasVencidas: cuotas ? Number(cuotas[3]) : null,
    cuotasPendientes: pendientes,
  };
  return parsed;
}
