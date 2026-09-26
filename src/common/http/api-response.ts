export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMIT'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export interface FieldErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode | string;
  details?: FieldErrorDetail[];
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
}

export interface ApiFailureResponse {
  success: false;
  data: null;
  message: string;
  error: ApiErrorBody;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiFailureResponse;

export interface PaginatedData<T = unknown> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function isApiSuccessEnvelope(
  value: unknown,
): value is ApiSuccessResponse {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.success === true &&
    'data' in obj &&
    typeof obj.message === 'string'
  );
}

export function isApiFailureEnvelope(
  value: unknown,
): value is ApiFailureResponse {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.success === false &&
    obj.data === null &&
    typeof obj.message === 'string' &&
    typeof obj.error === 'object' &&
    obj.error !== null
  );
}
