import { round4 } from '../../domain/money.js';
import { matchDate, matchMoney, matchRate } from '../matchers.js';
import { blankStatement, type ParsedStatement } from '../types.js';

export function parseBancoBogota(text: string): ParsedStatement {
  const parsed = blankStatement('BANCO_BOGOTA', 'CONSUMO', 'Banco de Bogotá');
  const dates = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
  const headerMoney = text.match(
    /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\$[\d.,]+)/,
  );
  const cuotaSaldo = text.match(/(\d{1,3})\s+(\$[\d.,]+)\s*"?En el evento/i);
  const approved = text.match(/(\$[\d.,]+)\s+(\d{1,3})\s*-{5,}/);
  const upcoming = text.split(/DETALLE PAGO A REALIZAR/i)[1] ?? '';
  const rates = text.match(
    /NOMINAL MES VENCIDO[\s\S]{0,120}?(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)/i,
  );

  parsed.productRef =
    text.match(/N[ÚU]MERO DE CR[ÉE]DITO\s+(\d{6,})/i)?.[1] ?? null;
  parsed.nextPaymentDate = dates?.[1] ? matchDate(dates[1], /(.+)/) : null;
  parsed.cutoffDate = dates?.[2] ? matchDate(dates[2], /(.+)/) : null;
  parsed.daysPastDue = headerMoney?.[3] ? Number(headerMoney[3]) : 0;
  parsed.installmentAmount = headerMoney?.[4]
    ? matchMoney(headerMoney[4], /(\$[\d.,]+)/)
    : matchMoney(text, /Valor Cuota\s*(\$[\d.,]+)/i);
  parsed.installmentCurrent = cuotaSaldo?.[1] ? Number(cuotaSaldo[1]) : null;
  parsed.remainingBalance = cuotaSaldo?.[2]
    ? matchMoney(cuotaSaldo[2], /(\$[\d.,]+)/)
    : matchMoney(text, /Saldo a Capital\s*(\$[\d.,]+)/i);
  parsed.originalAmount = approved?.[1]
    ? matchMoney(approved[1], /(\$[\d.,]+)/)
    : matchMoney(text, /VALOR APROBADO[\s\S]{0,40}?(\$[\d.,]+)/i);
  parsed.termMonths = approved?.[2] ? Number(approved[2]) : null;
  parsed.installmentTotal = parsed.termMonths;
  parsed.periodInterest = matchMoney(
    upcoming,
    /Intereses Corrientes(?:\s*\(\d+\))?\s*(\$[\d.,]+)/i,
  );
  parsed.insuranceOrOtherCharges = matchMoney(
    upcoming,
    /Otros Cargos\s*(\$[\d.,]+)/i,
  );
  parsed.installmentType = 'Compra de cartera';

  const namv = rates?.[1] ? matchRate(rates[1], /(.+)/) : null;
  const eaWithInsurance = rates?.[2] ? matchRate(rates[2], /(.+)/) : null;
  parsed.rateEa = eaWithInsurance;
  parsed.rateMv = namv != null && namv > 8 ? round4(namv / 12) : namv;
  parsed.extras = {
    namv,
    eaWithoutInsurance: rates?.[3] ? matchRate(rates[3], /(.+)/) : null,
    moraEa: rates?.[4] ? matchRate(rates[4], /(.+)/) : null,
    capitalBalance: matchMoney(text, /Saldo a Capital\s*(\$[\d.,]+)/i),
  };
  return parsed;
}
