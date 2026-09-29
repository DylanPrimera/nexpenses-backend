import { round2 } from './money.js';
import {
  amortPayment,
  amortRemaining,
  periodInterest,
  resolveRates,
} from './rates.js';
import type { CreditKindCode } from '../parsers/types.js';

export type ProjectionInput = {
  kind: CreditKindCode;
  remainingBalance: number;
  originalAmount: number | null;
  termMonths: number | null;
  installmentTotal: number | null;
  installmentCurrent: number | null;
  installmentAmount: number | null;
  insuranceOrOtherCharges: number | null;
  rateEa: number | null;
  rateMv: number | null;
};

export type ProjectionResult = {
  rateEa: number | null;
  rateMv: number | null;
  remainingBalance: number;
  periodInterest: number | null;
  installmentAmount: number | null;
};

export function projectFromRates(
  input: ProjectionInput,
  patch: { rateEa?: number | null; rateMv?: number | null },
  options: { recomputeBalance: boolean },
): ProjectionResult {
  const rates = resolveRates(
    { rateEa: input.rateEa, rateMv: input.rateMv },
    patch,
  );
  let remaining = input.remainingBalance;
  let installmentAmount = input.installmentAmount;
  const term = input.termMonths ?? input.installmentTotal;

  if (
    options.recomputeBalance &&
    input.kind === 'CONSUMO' &&
    input.originalAmount != null &&
    term != null &&
    term > 0 &&
    input.installmentCurrent != null &&
    rates.rateMv != null
  ) {
    const paid = Math.max(0, input.installmentCurrent - 1);
    const monthly = rates.rateMv / 100;
    remaining = amortRemaining(input.originalAmount, monthly, term, paid);
    const insurance = input.insuranceOrOtherCharges ?? 0;
    installmentAmount = round2(
      amortPayment(input.originalAmount, monthly, term) + insurance,
    );
  }

  return {
    rateEa: rates.rateEa,
    rateMv: rates.rateMv,
    remainingBalance: remaining,
    periodInterest:
      rates.rateMv == null ? null : periodInterest(remaining, rates.rateMv),
    installmentAmount,
  };
}
