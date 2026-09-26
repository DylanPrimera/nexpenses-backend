const DEFAULT_BY_METHOD: Record<string, string> = {
  GET: 'OK',
  POST: 'Creado correctamente',
  PUT: 'Actualizado correctamente',
  PATCH: 'Actualizado correctamente',
  DELETE: 'Eliminado correctamente',
};

export function defaultSuccessMessage(method: string): string {
  return DEFAULT_BY_METHOD[method.toUpperCase()] ?? 'OK';
}
