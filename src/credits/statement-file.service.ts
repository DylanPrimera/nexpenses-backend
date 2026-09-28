import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractPdfText } from './pdf/extract-pdf-text.js';

export const STATEMENT_TMP_PREFIX = 'nexpenses-credit-';
export const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

export type UploadedPdf = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

@Injectable()
export class StatementFileService {
  /**
   * Stage the PDF on temp disk, extract text, then delete the file.
   * The caller must not persist the path or any remote URL.
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

    const dir = await mkdtemp(join(tmpdir(), STATEMENT_TMP_PREFIX));
    const dest = join(dir, 'statement.pdf');
    try {
      await writeFile(dest, file.buffer);
      const stored = await readFile(dest);
      return await extractPdfText(stored);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('No se pudo leer el PDF del extracto');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
