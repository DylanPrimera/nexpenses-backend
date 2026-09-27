export function parseCOPInput(raw: string): number {
  const clean = raw.replace(/\./g, '').replace(/[^\d]/g, '');
  if (!clean) return 0;
  return Number.parseInt(clean, 10);
}
