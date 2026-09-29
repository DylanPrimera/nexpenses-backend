import { parseIcetex } from './adapters/icetex.js';
import { parseLuloConsumo } from './adapters/lulo-consumo.js';
import { parseNuTc } from './adapters/nu-tc.js';
import type { ColombianBankCode } from './colombian-banks.js';
import type { CreditKindCode, ParsedStatement } from './types.js';

export type ProviderRegistryEntry = {
  parse?: (text: string) => ParsedStatement;
  expectedKind?: CreditKindCode;
  fingerprint?: (foldedText: string) => boolean;
};

export const PROVIDER_REGISTRY: Partial<
  Record<ColombianBankCode, ProviderRegistryEntry>
> = {
  NU: { parse: parseNuTc, expectedKind: 'TC' },
  LULO: { parse: parseLuloConsumo, expectedKind: 'CONSUMO' },
  ICETEX: { parse: parseIcetex, expectedKind: 'CONSUMO' },
};

export function isRegistryEntryActive(
  entry: ProviderRegistryEntry,
  foldedText: string | undefined,
): boolean {
  if (!entry.fingerprint) return true;
  if (foldedText == null) return false;
  return entry.fingerprint(foldedText);
}
