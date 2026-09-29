import {
  bankLabel,
  matchColombianBank,
  type ColombianBankCode,
  type CreditProviderCode,
} from './colombian-banks.js';
import {
  isRegistryEntryActive,
  PROVIDER_REGISTRY,
  type ProviderParser,
} from './provider-registry.js';

export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function detectProvider(text: string): ColombianBankCode {
  const matched = matchColombianBank(foldText(text));
  return matched?.code ?? 'GENERIC';
}

export function resolveProviderParser(
  provider: ColombianBankCode,
  text: string,
): ProviderParser | null {
  const entry = PROVIDER_REGISTRY[provider];
  if (!entry?.parse) return null;
  if (!isRegistryEntryActive(entry, foldText(text))) return null;
  return entry.parse;
}

export function hasDedicatedAdapter(
  provider: ColombianBankCode,
  text: string,
): boolean {
  return resolveProviderParser(provider, text) != null;
}

export function providerLabel(provider: ColombianBankCode): string {
  if (provider === 'GENERIC') return 'el banco';
  return bankLabel(provider);
}

export function resolvePersistedProvider(
  detected: ColombianBankCode,
): CreditProviderCode {
  return detected;
}
