import { describe, expect, it } from 'vitest';
import { eaToMv, mvToEa } from '../domain/rates.js';
import {
  detectProvider,
  hasDedicatedAdapter,
} from './detect-provider.js';
import {
  parseCreditStatement,
  StatementParseError,
} from './parse-statement.js';

const samples = {
  nu: [
    'Nu Financiera',
    '• • • • 0000 • • • • 0001',
    'Tu cupo definido $3.350.000,00',
    'Usado $2.485.328,72',
    'Disponible $864.671,28',
    '$1.416.620,38 Deuda a pagar este mes',
    '+ $51.413,67 Intereses',
    'Cargos por conversión + $1.545,18',
    'Tasa 2.13%',
    'PAGO MÍNIMO $586.837,44',
    'Fecha límite de pago 07 OCT 2026',
    'Fecha de corte 17 SEP 2026',
  ].join('\n'),
  lulo: [
    'Lulo bank',
    '10000000001 5 de 9 Septiembre 21 - 2026',
    'Límite de pago: Oct. 01, 2026',
    'Valor a pagar cuota $121,844.50',
    'Intereses corrientes $11,491.32',
    'Seguro $1,042.89',
    'Saldo total a la fecha $586,663.96',
    'Monto solicitado $1,000,000.00',
    'Tasa de interés efectiva anual 22.5%',
    'Tipo de cuota Cuota fija',
  ].join('\n'),
  icetex: [
    'ICETEX',
    'Referencia de Pago 1000000001-7',
    '$0,00 $514.080,00 $514.080,00 05-10-26 0 AMORTIZACION',
    'Tasa mes vencido 1.37%',
    '17 0 0 17',
    'Capital $7.626.442,98 $432.891,27 $324.674,66',
    'Intereses Corrientes $132.488,37 $33.446,23 $181.187,45',
    'Otros $158.392,43 $8.209,84 $8.217,83',
    'Total $7.917.323,78',
    'Fecha corte 21-09-26',
    'N.A.M.V 16.42%',
  ].join('\n'),
  bancoBogota: [
    'Banco de Bogotá',
    'Extracto Compra de Cartera',
    'NÚMERO DE CRÉDITO 10000000002',
    '01/10/2026 06/09/2026 0 $313,676.00',
    '$6,000,000.00 24-----',
    'DETALLE PAGO A REALIZAR',
    'Valor Cuota $313,676.00',
    'Otros Cargos $4,822.00',
    'Intereses Corrientes (4) $91,112.93',
    'NOMINAL MES VENCIDO 20.90 23.02 23.02 24.98',
    '8 $4,517,484.48"En el evento',
  ].join('\n'),
  bancolombia: [
    'Bancolombia',
    'Extracto tarjeta de crédito',
    'Cupo definido $5.000.000,00',
    'Saldo total $1.250.000,00',
    'Pago mínimo $180.000,00',
    'Fecha límite de pago 15/10/2026',
    'Fecha de corte 30/09/2026',
    'Tasa mes vencido 2,45%',
  ].join('\n'),
  davivienda: [
    'Banco Davivienda',
    'Estado de cuenta crédito de consumo',
    'Saldo total a la fecha $2.100.000,00',
    'Valor cuota $350.000,00',
    'Fecha límite de pago 10/10/2026',
    'Tasa de interés efectiva anual 24,5%',
  ].join('\n'),
  nequi: [
    'Nequi',
    'Resumen de tu crédito',
    'Saldo total $800.000,00',
    'Pago mínimo $50.000,00',
    'Fecha límite de pago 22/10/2026',
  ].join('\n'),
  bancoBogotaTc: [
    'Banco de Bogotá',
    'Extracto tarjeta de crédito Mastercard',
    'Cupo definido $4.000.000,00',
    'Saldo total $900.000,00',
    'Pago mínimo $120.000,00',
    'Fecha límite de pago 18/10/2026',
    'Tasa mes vencido 2,10%',
  ].join('\n'),
};

describe('detectProvider dictionary', () => {
  it('detects dedicated adapter providers', () => {
    expect(detectProvider(samples.nu)).toBe('NU');
    expect(detectProvider(samples.lulo)).toBe('LULO');
    expect(detectProvider(samples.icetex)).toBe('ICETEX');
  });

  it('detects major Colombian banks via dictionary aliases', () => {
    expect(detectProvider(samples.bancolombia)).toBe('BANCOLOMBIA');
    expect(detectProvider(samples.davivienda)).toBe('DAVIVIENDA');
    expect(detectProvider(samples.nequi)).toBe('NEQUI');
    expect(detectProvider('Scotiabank Colpatria extracto de tarjeta')).toBe(
      'SCOTIABANK_COLPATRIA',
    );
    expect(detectProvider('CMR Falabella tarjeta de crédito')).toBe(
      'FALABELLA',
    );
    expect(detectProvider('RappiCard estado de cuenta')).toBe('RAPPICARD');
    expect(detectProvider('BBVA Colombia cupo disponible')).toBe('BBVA');
    expect(detectProvider('Banco de Occidente crédito')).toBe(
      'BANCO_OCCIDENTE',
    );
    expect(detectProvider('Banco AV Villas extracto')).toBe('AV_VILLAS');
    expect(detectProvider('Banco Caja Social crédito')).toBe('CAJA_SOCIAL');
    expect(detectProvider('Banco Popular extracto')).toBe('BANCO_POPULAR');
    expect(detectProvider('Banco Pichincha saldo')).toBe('PICHINCHA');
    expect(detectProvider('Banco Agrario de Colombia')).toBe('AGRARIO');
    expect(detectProvider('Serfinanza tarjeta')).toBe('SERFINANZA');
    expect(detectProvider('Ban100 crédito digital')).toBe('BAN100');
    expect(detectProvider('Iris Bank extracto')).toBe('IRIS');
  });

  it('treats Banco de Bogotá as a dictionary-only provider', () => {
    expect(detectProvider(samples.bancoBogotaTc)).toBe('BANCO_BOGOTA');
    expect(hasDedicatedAdapter('BANCO_BOGOTA', samples.bancoBogota)).toBe(
      false,
    );
  });

  it('does not pin registry banks to a fixed kind', () => {
    expect(hasDedicatedAdapter('NU', samples.nu)).toBe(true);
    expect(hasDedicatedAdapter('LULO', samples.lulo)).toBe(true);
    expect(hasDedicatedAdapter('ICETEX', samples.icetex)).toBe(true);
    // Kind is chosen by the user / caller — registry only wires parsers.
    expect(parseCreditStatement(samples.nu, 'TC').kind).toBe('TC');
    expect(parseCreditStatement(samples.nu, 'CONSUMO').kind).toBe('CONSUMO');
    expect(parseCreditStatement(samples.lulo, 'TC').kind).toBe('TC');
    expect(parseCreditStatement(samples.icetex, 'TC').kind).toBe('TC');
  });
});

describe('parseCreditStatement inline samples', () => {
  it('parses an anonymized Nu consumer-credit statement', () => {
    const parsed = parseCreditStatement(samples.nu, 'CONSUMO');
    expect(parsed.provider).toBe('NU');
    expect(parsed.kind).toBe('CONSUMO');
    expect(parsed.productRef).toBe('0000/0001');
    expect(parsed.creditLimit).toBe(3350000);
    expect(parsed.usedAmount).toBe(2485328.72);
    expect(parsed.availableCredit).toBe(864671.28);
    expect(parsed.remainingBalance).toBe(2485328.72);
    expect(parsed.minPayment).toBe(586837.44);
    expect(parsed.amountDueThisPeriod).toBe(1416620.38);
    expect(parsed.installmentAmount).toBe(586837.44);
    expect(parsed.periodInterest).toBe(51413.67);
    expect(parsed.insuranceOrOtherCharges).toBe(1545.18);
    expect(parsed.nextPaymentDate).toBe('2026-10-07');
    expect(parsed.cutoffDate).toBe('2026-09-17');
    expect(parsed.rateMv).toBe(2.13);
    expect(parsed.rateEa).toBe(mvToEa(2.13));
    expect(JSON.stringify(parsed)).not.toMatch(/https?:\/\//);
  });

  it('parses an anonymized Lulo consumer-loan statement', () => {
    const parsed = parseCreditStatement(samples.lulo, 'CONSUMO');
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
    const parsed = parseCreditStatement(samples.icetex, 'CONSUMO');
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

  it('uses parseGeneric for dictionary banks without a dedicated adapter', () => {
    const parsed = parseCreditStatement(samples.bancolombia, 'TC');
    expect(parsed.provider).toBe('BANCOLOMBIA');
    expect(parsed.bankName).toBe('Bancolombia');
    expect(parsed.remainingBalance).toBe(1250000);
    expect(parsed.minPayment).toBe(180000);
    expect(parsed.creditLimit).toBe(5000000);
    expect(parsed.nextPaymentDate).toBe('2026-10-15');
  });

  it('parses Davivienda consumo via generic without wrong-kind errors', () => {
    const parsed = parseCreditStatement(samples.davivienda, 'CONSUMO');
    expect(parsed.provider).toBe('DAVIVIENDA');
    expect(parsed.bankName).toBe('Davivienda');
    expect(parsed.remainingBalance).toBe(2100000);
    expect(parsed.installmentAmount).toBe(350000);
    expect(parsed.nextPaymentDate).toBe('2026-10-10');
    expect(parsed.rateEa).toBe(24.5);
  });

  it('parses Nequi via dictionary + generic for either kind', () => {
    const asTc = parseCreditStatement(samples.nequi, 'TC');
    expect(asTc.provider).toBe('NEQUI');
    expect(asTc.bankName).toBe('Nequi');
    expect(asTc.remainingBalance).toBe(800000);

    const asConsumo = parseCreditStatement(samples.nequi, 'CONSUMO');
    expect(asConsumo.provider).toBe('NEQUI');
    expect(asConsumo.bankName).toBe('Nequi');
  });

  it('parses Banco de Bogotá via generic without forcing CONSUMO', () => {
    const parsed = parseCreditStatement(samples.bancoBogotaTc, 'TC');
    expect(parsed.provider).toBe('BANCO_BOGOTA');
    expect(parsed.bankName).toBe('Banco de Bogotá');
    expect(parsed.remainingBalance).toBe(900000);
    expect(parsed.minPayment).toBe(120000);
    expect(parsed.kind).toBe('TC');
  });

  it('rejects a statement that is missing critical fields', () => {
    expect(() =>
      parseCreditStatement(
        'Banco Ejemplo\nSin cifras útiles en este texto largo',
        'TC',
      ),
    ).toThrow(StatementParseError);
  });

  it('accepts Nu as either TC or CONSUMO from user selection', () => {
    const asTc = parseCreditStatement(samples.nu, 'TC');
    expect(asTc.provider).toBe('NU');
    expect(asTc.kind).toBe('TC');
    expect(asTc.remainingBalance).toBe(2485328.72);
    expect(asTc.minPayment).toBe(586837.44);

    const asConsumo = parseCreditStatement(samples.nu, 'CONSUMO');
    expect(asConsumo.provider).toBe('NU');
    expect(asConsumo.kind).toBe('CONSUMO');
  });

  it('does not reject registry or dictionary banks for either selected kind', () => {
    expect(() => parseCreditStatement(samples.nu, 'TC')).not.toThrow();
    expect(() => parseCreditStatement(samples.lulo, 'TC')).not.toThrow();
    expect(() => parseCreditStatement(samples.icetex, 'TC')).not.toThrow();
    expect(() =>
      parseCreditStatement(samples.bancolombia, 'CONSUMO'),
    ).not.toThrow();
    expect(() => parseCreditStatement(samples.davivienda, 'TC')).not.toThrow();
    expect(() =>
      parseCreditStatement(samples.bancoBogotaTc, 'CONSUMO'),
    ).not.toThrow();
  });
});
