import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { extractPdfText } from './pdf/extract-pdf-text.js';

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
  constructor(private readonly config: ConfigService) {
    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (cloudinaryUrl) {
      cloudinary.config(cloudinaryUrl);
    } else if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    } else {
      throw new Error(
        'Configura CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET',
      );
    }
  }

  /**
   * Stage the PDF on Cloudinary (raw, private), extract text from the upload
   * buffer, then destroy the remote asset immediately. Never persist the URL.
   * Cloudinary is used so concurrent statement uploads do not fill Nest disk.
   */
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
      throw new BadRequestException('No se pudo leer el PDF del extracto');
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
