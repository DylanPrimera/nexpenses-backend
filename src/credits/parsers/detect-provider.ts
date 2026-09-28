import type { CreditKindCode, CreditProviderCode } from './types.js';

export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function detectProvider(text: string): CreditProviderCode {
  const n = foldText(text);
  if (n.includes('icetex')) return 'ICETEX';
  if (n.includes('lulo')) return 'LULO';
  if (
    n.includes('nu financiera') ||
    n.includes('nu colombia') ||
    n.includes('ayuda@nu.com.co') ||
    n.includes('nucf.com.co')
  ) {
    return 'NU';
  }
  if (n.includes('banco de bogota') && n.includes('compra de cartera')) {
    return 'BANCO_BOGOTA';
  }
  return 'GENERIC';
}

const PROVIDER_KIND: Partial<Record<CreditProviderCode, CreditKindCode>> = {
  NU: 'TC',
  LULO: 'CONSUMO',
  ICETEX: 'CONSUMO',
  BANCO_BOGOTA: 'CONSUMO',
};

export function expectedKind(
  provider: CreditProviderCode,
): CreditKindCode | null {
  return PROVIDER_KIND[provider] ?? null;
}

export function providerLabel(provider: CreditProviderCode): string {
  switch (provider) {
    case 'NU':
      return 'Nu';
    case 'LULO':
      return 'Lulo';
    case 'ICETEX':
      return 'ICETEX';
    case 'BANCO_BOGOTA':
      return 'Banco de Bogotá';
    default:
      return 'el banco';
  }
}

export function kindLabel(kind: CreditKindCode): string {
  return kind === 'TC' ? 'tarjeta de crédito' : 'crédito de consumo';
}
