import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type {
  ApiErrorCode,
  ApiFailureResponse,
  FieldErrorDetail,
} from './api-response.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const body = this.toFailureResponse(exception);
    response.status(body.error.statusCode).json(body);
  }

  private toFailureResponse(exception: unknown): ApiFailureResponse {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    if (
      exception instanceof Error &&
      'code' in exception &&
      (exception as { code?: string }).code === 'LIMIT_FILE_SIZE'
    ) {
      return {
        success: false,
        data: null,
        message: 'El PDF supera el tamaño máximo permitido (8 MB)',
        error: {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'BAD_REQUEST',
        },
      };
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      success: false,
      data: null,
      message: 'Error interno del servidor',
      error: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
      },
    };
  }

  private fromHttpException(exception: HttpException): ApiFailureResponse {
    const statusCode = exception.getStatus();
    const raw = exception.getResponse();

    let message = exception.message || 'Error';
    let details: FieldErrorDetail[] | undefined;
    let codeOverride: string | undefined;

    if (typeof raw === 'string') {
      message = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;

      if (typeof obj.code === 'string') {
        codeOverride = obj.code;
      }

      if (Array.isArray(obj.details)) {
        details = obj.details as FieldErrorDetail[];
      }

      if (typeof obj.message === 'string') {
        message = obj.message;
      } else if (Array.isArray(obj.message)) {
        message = 'Error de validación';
        details = details ?? this.detailsFromMessageArray(obj.message);
      }
    }

    const code =
      codeOverride ?? this.codeFromStatus(statusCode, Boolean(details?.length));

    if (statusCode >= 500) {
      this.logger.error(message, exception.stack);
    }

    return {
      success: false,
      data: null,
      message,
      error: {
        statusCode,
        code,
        ...(details && details.length > 0 ? { details } : {}),
      },
    };
  }

  private fromPrisma(
    error: Prisma.PrismaClientKnownRequestError,
  ): ApiFailureResponse {
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : target
          ? [String(target)]
          : [];
      const details: FieldErrorDetail[] = fields.map((field) => ({
        field,
        message: `${field} already exists`,
      }));
      return {
        success: false,
        data: null,
        message: 'Conflicto: el recurso ya existe',
        error: {
          statusCode: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          ...(details.length > 0 ? { details } : {}),
        },
      };
    }

    if (error.code === 'P2025') {
      return {
        success: false,
        data: null,
        message: 'Recurso no encontrado',
        error: {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
        },
      };
    }

    this.logger.error(`Prisma ${error.code}`, error.message);
    return {
      success: false,
      data: null,
      message: 'Error de base de datos',
      error: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
      },
    };
  }

  private codeFromStatus(
    status: number,
    hasFieldDetails: boolean,
  ): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return hasFieldDetails ? 'VALIDATION_ERROR' : 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT';
      default:
        if (status >= 500) return 'INTERNAL_ERROR';
        return 'BAD_REQUEST';
    }
  }

  private detailsFromMessageArray(messages: unknown[]): FieldErrorDetail[] {
    return messages.map((item) => {
      const text = String(item);
      const fieldMatch = /^(\w+)\s/.exec(text);
      return {
        field: fieldMatch?.[1] ?? '_',
        message: text,
      };
    });
  }
}
