export type CreditKindCode = 'TC' | 'CONSUMO';
export type CreditProviderCode =
  'NU' | 'LULO' | 'ICETEX' | 'BANCO_BOGOTA' | 'GENERIC';

export type ParsedStatement = {
  provider: CreditProviderCode;
  kind: CreditKindCode;
  bankName: string;
  displayName: string;
  productRef: string | null;
  cutoffDate: string | null;
  nextPaymentDate: string | null;
  daysPastDue: number;
  remainingBalance: number | null;
  periodInterest: number | null;
  insuranceOrOtherCharges: number | null;
  rateEa: number | null;
  rateMv: number | null;
  creditLimit: number | null;
  availableCredit: number | null;
  usedAmount: number | null;
  minPayment: number | null;
  amountDueThisPeriod: number | null;
  installmentAmount: number | null;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  originalAmount: number | null;
  termMonths: number | null;
  installmentType: string | null;
  stage: string | null;
  extras: Record<string, unknown>;
};

export class StatementParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatementParseError';
  }
}

export function blankStatement(
  provider: CreditProviderCode,
  kind: CreditKindCode,
  bankName: string,
): ParsedStatement {
  return {
    provider,
    kind,
    bankName,
    displayName: bankName,
    productRef: null,
    cutoffDate: null,
    nextPaymentDate: null,
    daysPastDue: 0,
    remainingBalance: null,
    periodInterest: null,
    insuranceOrOtherCharges: null,
    rateEa: null,
    rateMv: null,
    creditLimit: null,
    availableCredit: null,
    usedAmount: null,
    minPayment: null,
    amountDueThisPeriod: null,
    installmentAmount: null,
    installmentCurrent: null,
    installmentTotal: null,
    originalAmount: null,
    termMonths: null,
    installmentType: null,
    stage: null,
    extras: {},
  };
}
