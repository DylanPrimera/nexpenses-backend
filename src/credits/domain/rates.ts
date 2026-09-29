import { round2, round4 } from './money.js';

export function eaToMv(eaPercent: number): number {
  return round4((Math.pow(1 + eaPercent / 100, 1 / 12) - 1) * 100);
}

export function mvToEa(mvPercent: number): number {
  return round4((Math.pow(1 + mvPercent / 100, 12) - 1) * 100);
}

export function resolveRates(
  current: { rateEa: number | null; rateMv: number | null },
  patch: { rateEa?: number | null; rateMv?: number | null },
): { rateEa: number | null; rateMv: number | null } {
  const eaProvided = patch.rateEa != null;
  const mvProvided = patch.rateMv != null;
  let rateEa = eaProvided ? patch.rateEa! : current.rateEa;
  let rateMv = mvProvided ? patch.rateMv! : current.rateMv;

  if (eaProvided && !mvProvided && rateEa != null) rateMv = eaToMv(rateEa);
  if (mvProvided && !eaProvided && rateMv != null) rateEa = mvToEa(rateMv);
  if (!eaProvided && !mvProvided) {
    if (rateEa != null && rateMv == null) rateMv = eaToMv(rateEa);
    if (rateMv != null && rateEa == null) rateEa = mvToEa(rateMv);
  }

  return {
    rateEa: rateEa == null ? null : round4(rateEa),
    rateMv: rateMv == null ? null : round4(rateMv),
  };
}

export function amortRemaining(
  principal: number,
  monthlyRate: number,
  term: number,
  paid: number,
): number {
  if (term <= 0) return round2(principal);
  const k = Math.min(Math.max(paid, 0), term);
  if (monthlyRate === 0) return round2((principal * (term - k)) / term);
  const powN = Math.pow(1 + monthlyRate, term);
  const powK = Math.pow(1 + monthlyRate, k);
  return round2((principal * (powN - powK)) / (powN - 1));
}

export function amortPayment(
  principal: number,
  monthlyRate: number,
  term: number,
): number {
  if (term <= 0) return round2(principal);
  if (monthlyRate === 0) return round2(principal / term);
  const powN = Math.pow(1 + monthlyRate, term);
  return round2((principal * monthlyRate * powN) / (powN - 1));
}

export function periodInterest(balance: number, rateMvPercent: number): number {
  const cents = Math.round(balance * 100);
  const interestCents = Math.round((cents * rateMvPercent) / 100);
  return interestCents / 100;
}
