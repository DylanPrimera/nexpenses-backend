import { parseIcetex } from './adapters/icetex.js';
import { parseLuloConsumo } from './adapters/lulo-consumo.js';
import { parseNu } from './adapters/nu.js';
import type { ColombianBankCode } from './colombian-banks.js';
import type { CreditKindCode, ParsedStatement } from './types.js';

export type ProviderParser = (
  text: string,
  kind: CreditKindCode,
) => ParsedStatement;

export type ProviderRegistryEntry = {
  parse?: ProviderParser;
  fingerprint?: (foldedText: string) => boolean;
};

export const PROVIDER_REGISTRY: Partial<
  Record<ColombianBankCode, ProviderRegistryEntry>
> = {
  NU: { parse: parseNu },
  LULO: { parse: parseLuloConsumo },
  ICETEX: { parse: parseIcetex },
};

export function isRegistryEntryActive(
  entry: ProviderRegistryEntry,
  foldedText: string | undefined,
): boolean {
  if (!entry.fingerprint) return true;
  if (foldedText == null) return false;
  return entry.fingerprint(foldedText);
}
