import { resolveRates } from '../domain/rates.js';
import { parseGeneric } from './adapters/generic.js';
import { bankLabel } from './colombian-banks.js';
import {
  detectProvider,
  expectedKind,
  kindLabel,
  providerLabel,
  resolvePersistedProvider,
  resolveProviderParser,
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

  const detected = detectProvider(source);
  const expected = expectedKind(detected, source);
  if (expected && expected !== kind) {
    throw new StatementParseError(
      `El extracto corresponde a ${providerLabel(detected)} (${kindLabel(expected)}) y no coincide con el tipo seleccionado.`,
    );
  }

  const parseAdapter = resolveProviderParser(detected, source);
  const parsed = parseAdapter
    ? parseAdapter(source)
    : parseGeneric(source, kind);

  parsed.kind = kind;
  parsed.provider = resolvePersistedProvider(detected);
  if (detected !== 'GENERIC') {
    const label = bankLabel(detected);
    parsed.bankName = label;
    if (!parsed.displayName || parsed.displayName === 'Otro') {
      parsed.displayName = label;
    }
  }

  const rates = resolveRates(
    { rateEa: parsed.rateEa, rateMv: parsed.rateMv },
    {},
  );
  parsed.rateEa = rates.rateEa;
  parsed.rateMv = rates.rateMv;
  assertCritical(parsed);
  return parsed;
}
