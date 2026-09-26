
export const CATEGORY_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#84cc16',
  '#06b6d4',
  '#e11d48',
] as const;

export function nextCategoryColor(existingCount: number): string {
  return CATEGORY_COLORS[existingCount % CATEGORY_COLORS.length];
}

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}
