import { resolveRates } from '../domain/rates.js';
import { parseBancoBogota } from './adapters/banco-bogota.js';
import { parseGeneric } from './adapters/generic.js';
import { parseIcetex } from './adapters/icetex.js';
import { parseLuloConsumo } from './adapters/lulo-consumo.js';
import { parseNuTc } from './adapters/nu-tc.js';
import {
  detectProvider,
  expectedKind,
  kindLabel,
  providerLabel,
} from './detect-provider.js';
import {
  StatementParseError,
  type CreditKindCode,
  type ParsedStatement,
} from './types.js';

export { StatementParseError };

function isPresentMoney(value: number | null): boolean {
  return value != null && Number.isFinite(value) && value >= 0;
}

export function assertCritical(parsed: ParsedStatement): void {
  const missing: string[] = [];
  if (!isPresentMoney(parsed.remainingBalance)) missing.push('saldo');
  if (!parsed.nextPaymentDate) missing.push('fecha límite de pago');
  if (
    !isPresentMoney(parsed.minPayment) &&
    !isPresentMoney(parsed.installmentAmount)
  ) {
    missing.push('pago mínimo o valor de la cuota');
  }
  if (missing.length) {
    throw new StatementParseError(
      `No se pudo leer el extracto. Faltan datos obligatorios: ${missing.join(', ')}.`,
    );
  }
}

export function parseCreditStatement(
  text: string,
  kind: CreditKindCode,
): ParsedStatement {
  const source = text.split('\u0000').join('').trim();
  if (source.length < 20) {
    throw new StatementParseError(
      'No se pudo leer el extracto: el PDF no tiene texto.',
    );
  }

  const provider = detectProvider(source);
  const expected = expectedKind(provider);
  if (expected && expected !== kind) {
    throw new StatementParseError(
      `El extracto corresponde a ${providerLabel(provider)} (${kindLabel(expected)}) y no coincide con el tipo seleccionado.`,
    );
  }

  const parsed =
    provider === 'NU'
      ? parseNuTc(source)
      : provider === 'LULO'
        ? parseLuloConsumo(source)
        : provider === 'ICETEX'
          ? parseIcetex(source)
          : provider === 'BANCO_BOGOTA'
            ? parseBancoBogota(source)
            : parseGeneric(source, kind);

  parsed.kind = kind;
  const rates = resolveRates(
    { rateEa: parsed.rateEa, rateMv: parsed.rateMv },
    {},
  );
  parsed.rateEa = rates.rateEa;
  parsed.rateMv = rates.rateMv;
  assertCritical(parsed);
  return parsed;
}
