import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { extractPdfText } from './pdf/extract-pdf-text.js';

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const message = obj.message ?? obj.error ?? obj.msg;
    if (typeof message === 'string' && message.trim()) return message;
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}


export const STATEMENT_CLOUDINARY_FOLDER = 'nexpenses/statements-tmp';
export const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

export type UploadedPdf = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

@Injectable()
export class StatementFileService {
  private readonly logger = new Logger(StatementFileService.name);

  constructor(private readonly config: ConfigService) {
    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');

    if (cloudinaryUrl) {
      cloudinary.config(cloudinaryUrl);
    }  else {
      throw new Error(
        'Configura CLOUDINARY_URL',
      );
    }
  }

  async consume(file: UploadedPdf | undefined): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta el PDF del extracto');
    }
    if (file.buffer.length > MAX_STATEMENT_BYTES) {
      throw new BadRequestException(
        'El PDF supera el tamaño máximo permitido (8 MB)',
      );
    }
    const head = file.buffer.subarray(0, 1024).toString('latin1');
    if (!head.includes('%PDF')) {
      throw new BadRequestException('El archivo debe ser un PDF');
    }

    let publicId: string | undefined;
    try {
      const uploaded = await this.uploadRaw(file.buffer, file.originalname);
      publicId = uploaded.public_id;
      return await extractPdfText(file.buffer);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const detail = formatUnknownError(error);
      this.logger.error(
        `Failed to read statement PDF: ${detail}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        `No se pudo leer el PDF del extracto: ${detail}`,
      );
    } finally {
      if (publicId) {
        await this.destroyRaw(publicId);
      }
    }
  }

  private uploadRaw(
    buffer: Buffer,
    originalname?: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'private',
          folder: STATEMENT_CLOUDINARY_FOLDER,
          use_filename: false,
          unique_filename: true,
          overwrite: false,
          tags: ['nexpenses-statement-tmp'],
          context: originalname ? `filename=${originalname}` : undefined,
        },
        (err, result) => {
          if (err || !result) {
            reject(err ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }

  private async destroyRaw(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
        type: 'private',
        invalidate: true,
      });
    } catch {
    }
  }
}
