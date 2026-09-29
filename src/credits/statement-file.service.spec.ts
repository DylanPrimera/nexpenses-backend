import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCreditStatement } from './parsers/parse-statement.js';

const uploadStreamMock = vi.fn();
const destroyMock = vi.fn();

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: (...args: unknown[]) => uploadStreamMock(...args),
      destroy: (...args: unknown[]) => destroyMock(...args),
    },
  },
}));

import { StatementFileService } from './statement-file.service.js';

function pdfWithText(lines: string[]): Buffer {
  const escape = (value: string) => value.replace(/([\\()])/g, '\\$1');
  const stream = [
    'BT',
    '/F1 12 Tf',
    '72 720 Td',
    ...lines.map((line) => `(${escape(line)}) Tj 0 -16 Td`),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

function configStub(): ConfigService {
  return {
    get: (key: string) =>
      ({
        CLOUDINARY_URL: 'cloudinary://key:secret@test-cloud',
      })[key],
  } as ConfigService;
}

describe('StatementFileService', () => {
  beforeEach(() => {
    uploadStreamMock.mockReset();
    destroyMock.mockReset();
    destroyMock.mockResolvedValue({ result: 'ok' });
    uploadStreamMock.mockImplementation((_opts: unknown, cb: Function) => {
      queueMicrotask(() =>
        cb(undefined, { public_id: 'nexpenses/statements-tmp/abc123' }),
      );
      return { end: (_buf: Buffer) => undefined };
    });
  });

  it('stages on Cloudinary, reads the PDF, and destroys the remote asset', async () => {
    const service = new StatementFileService(configStub());
    const buffer = pdfWithText([
      'Extracto tarjeta Banco Ejemplo',
      'Cupo definido $1.200.000,00',
      'Saldo total $250.000,00',
      'Pago minimo $40.000,00',
      'Fecha limite de pago 20/10/2026',
      'Tasa mes vencido 1,90%',
    ]);
    const text = await service.consume({
      buffer,
      originalname: 'inline-statement.pdf',
      mimetype: 'application/pdf',
    });
    expect(uploadStreamMock).toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalledWith(
      'nexpenses/statements-tmp/abc123',
      expect.objectContaining({ resource_type: 'raw', type: 'private' }),
    );
    const parsed = parseCreditStatement(text, 'TC');
    expect(parsed.provider).toBe('GENERIC');
    expect(parsed.remainingBalance).toBe(250000);
    expect(parsed.minPayment).toBe(40000);
    expect(parsed.nextPaymentDate).toBe('2026-10-20');
  });

  it('destroys the Cloudinary asset when the PDF cannot be parsed', async () => {
    const service = new StatementFileService(configStub());
    const buffer = Buffer.from('%PDF-1.4\nthis is not a real pdf');
    await expect(
      service.consume({ buffer, originalname: 'broken.pdf' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(destroyMock).toHaveBeenCalledWith(
      'nexpenses/statements-tmp/abc123',
      expect.objectContaining({ resource_type: 'raw' }),
    );
  });
});
