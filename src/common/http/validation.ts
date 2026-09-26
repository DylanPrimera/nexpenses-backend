import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import type { FieldErrorDetail } from './api-response.js';

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldErrorDetail[] {
  const details: FieldErrorDetail[] = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        details.push({ field, message });
      }
    }

    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}

export function createAppValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      exposeUnsetFields: false,
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors: ValidationError[]) => {
      const details = flattenValidationErrors(errors);
      return new BadRequestException({
        message: 'Error de validación',
        code: 'VALIDATION_ERROR',
        details,
      });
    },
  });
}
