import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseCreditStatement } from './parsers/parse-statement.js';
import {
  STATEMENT_TMP_PREFIX,
  StatementFileService,
} from './statement-file.service.js';

const here = dirname(fileURLToPath(import.meta.url));

function stagedDirs(): string[] {
  return readdirSync(tmpdir()).filter((name) =>
    name.startsWith(STATEMENT_TMP_PREFIX),
  );
}

describe('StatementFileService', () => {
  const service = new StatementFileService();

  it('reads a PDF from temp disk and deletes it', async () => {
    const before = stagedDirs();
    const buffer = readFileSync(
      join(here, 'parsers/__fixtures__/generic-statement.pdf'),
    );
    const text = await service.consume({
      buffer,
      originalname: 'generic-statement.pdf',
      mimetype: 'application/pdf',
    });
    expect(stagedDirs()).toEqual(before);
    const parsed = parseCreditStatement(text, 'TC');
    expect(parsed.provider).toBe('GENERIC');
    expect(parsed.remainingBalance).toBe(250000);
    expect(parsed.minPayment).toBe(40000);
    expect(parsed.nextPaymentDate).toBe('2026-10-20');
    expect(text).not.toMatch(/cloudinary|https?:\/\//i);
  });

  it('deletes the temp file when the PDF cannot be parsed', async () => {
    const before = stagedDirs();
    const buffer = Buffer.from('%PDF-1.4\nthis is not a real pdf');
    await expect(
      service.consume({ buffer, originalname: 'broken.pdf' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stagedDirs()).toEqual(before);
  });
});
