import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { eaToMv, mvToEa } from '../domain/rates.js';
import {
  parseCreditStatement,
  StatementParseError,
} from './parse-statement.js';

const here = dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(join(here, '__fixtures__', name), 'utf8');
}

describe('parseCreditStatement fixtures', () => {
  it('parses an anonymized Nu credit-card statement', () => {
    const parsed = parseCreditStatement(fixture('nu-tc.txt'), 'TC');
    expect(parsed.provider).toBe('NU');
    expect(parsed.kind).toBe('TC');
    expect(parsed.productRef).toBe('0000/0001');
    expect(parsed.creditLimit).toBe(3350000);
    expect(parsed.usedAmount).toBe(2485328.72);
    expect(parsed.availableCredit).toBe(864671.28);
    expect(parsed.remainingBalance).toBe(2485328.72);
    expect(parsed.minPayment).toBe(586837.44);
    expect(parsed.amountDueThisPeriod).toBe(1416620.38);
    expect(parsed.periodInterest).toBe(51413.67);
    expect(parsed.insuranceOrOtherCharges).toBe(1545.18);
    expect(parsed.nextPaymentDate).toBe('2026-10-07');
    expect(parsed.cutoffDate).toBe('2026-09-17');
    expect(parsed.rateMv).toBe(2.13);
    expect(parsed.rateEa).toBe(mvToEa(2.13));
    expect(JSON.stringify(parsed)).not.toMatch(/https?:\/\//);
  });

  it('parses an anonymized Lulo consumer-loan statement', () => {
    const parsed = parseCreditStatement(fixture('lulo-consumo.txt'), 'CONSUMO');
    expect(parsed.provider).toBe('LULO');
    expect(parsed.productRef).toBe('10000000001');
    expect(parsed.installmentCurrent).toBe(5);
    expect(parsed.installmentTotal).toBe(9);
    expect(parsed.termMonths).toBe(9);
    expect(parsed.cutoffDate).toBe('2026-09-21');
    expect(parsed.nextPaymentDate).toBe('2026-10-01');
    expect(parsed.installmentAmount).toBe(121844.5);
    expect(parsed.periodInterest).toBe(11491.32);
    expect(parsed.insuranceOrOtherCharges).toBe(1042.89);
    expect(parsed.remainingBalance).toBe(586663.96);
    expect(parsed.originalAmount).toBe(1000000);
    expect(parsed.rateEa).toBe(22.5);
    expect(parsed.rateMv).toBe(eaToMv(22.5));
    expect(parsed.installmentType).toBe('Cuota fija');
    expect(parsed.daysPastDue).toBe(0);
  });

  it('parses an anonymized ICETEX statement', () => {
    const parsed = parseCreditStatement(fixture('icetex.txt'), 'CONSUMO');
    expect(parsed.provider).toBe('ICETEX');
    expect(parsed.productRef).toBe('1000000001-7');
    expect(parsed.remainingBalance).toBe(7917323.78);
    expect(parsed.installmentAmount).toBe(514080);
    expect(parsed.minPayment).toBe(514080);
    expect(parsed.periodInterest).toBe(181187.45);
    expect(parsed.insuranceOrOtherCharges).toBe(8217.83);
    expect(parsed.nextPaymentDate).toBe('2026-10-05');
    expect(parsed.cutoffDate).toBe('2026-09-21');
    expect(parsed.daysPastDue).toBe(0);
    expect(parsed.stage).toBe('AMORTIZACION');
    expect(parsed.installmentCurrent).toBe(1);
    expect(parsed.installmentTotal).toBe(17);
    expect(parsed.termMonths).toBe(17);
    expect(parsed.rateMv).toBe(1.37);
    expect(parsed.rateEa).toBe(mvToEa(1.37));
    expect(parsed.extras.namv).toBe(16.42);
  });

  it('parses an anonymized Banco de Bogotá portfolio-purchase statement', () => {
    const parsed = parseCreditStatement(
      fixture('banco-bogota-cartera.txt'),
      'CONSUMO',
    );
    expect(parsed.provider).toBe('BANCO_BOGOTA');
    expect(parsed.productRef).toBe('10000000002');
    expect(parsed.nextPaymentDate).toBe('2026-10-01');
    expect(parsed.cutoffDate).toBe('2026-09-06');
    expect(parsed.daysPastDue).toBe(0);
    expect(parsed.installmentAmount).toBe(313676);
    expect(parsed.installmentCurrent).toBe(8);
    expect(parsed.remainingBalance).toBe(4517484.48);
    expect(parsed.originalAmount).toBe(6000000);
    expect(parsed.termMonths).toBe(24);
    expect(parsed.periodInterest).toBe(91112.93);
    expect(parsed.insuranceOrOtherCharges).toBe(4822);
    expect(parsed.rateEa).toBe(23.02);
    expect(parsed.rateMv).toBeCloseTo(20.9 / 12, 4);
    expect(parsed.installmentType).toBe('Compra de cartera');
  });

  it('uses the generic adapter for an unlabeled statement', () => {
    const parsed = parseCreditStatement(
      [
        'Extracto tarjeta Banco Ejemplo',
        'Cupo definido $1.200.000,00',
        'Saldo total $250.000,00',
        'Pago mínimo $40.000,00',
        'Fecha límite de pago 20/10/2026',
        'Tasa mes vencido 1,90%',
      ].join('\n'),
      'TC',
    );
    expect(parsed.provider).toBe('GENERIC');
    expect(parsed.creditLimit).toBe(1200000);
    expect(parsed.remainingBalance).toBe(250000);
    expect(parsed.minPayment).toBe(40000);
    expect(parsed.nextPaymentDate).toBe('2026-10-20');
    expect(parsed.rateMv).toBe(1.9);
  });

  it('rejects a statement that is missing critical fields', () => {
    expect(() =>
      parseCreditStatement(
        'Banco Ejemplo\nSin cifras útiles en este texto largo',
        'TC',
      ),
    ).toThrow(StatementParseError);
  });

  it('rejects a provider that does not match the selected kind', () => {
    expect(() => parseCreditStatement(fixture('nu-tc.txt'), 'CONSUMO')).toThrow(
      /no coincide con el tipo seleccionado/,
    );
  });
});
