import { describe, expect, it } from 'vitest';
import { parseBankNotice } from './parse-bank-notice.js';

describe('parseBankNotice', () => {
  it('parses an anonymized Banco de Bogotá transfer with *Monto:* markdown', () => {
    const raw = [
      'Transferiste a la cuenta destino: 3023226053',
      '*Monto:* $28,000',
      'Canal: Banca Móvil',
      'Referencia: 18680700104911522988594487087780118',
    ].join('\n');
    const notice = parseBankNotice(raw);
    expect(notice.amount).toBe(28000);
    expect(notice.merchant).toBe('3023226053');
    expect(notice.paymentType).toBe('debit_card');
    expect(notice.reference).toBe('18680700104911522988594487087780118');
    expect(notice.snippet).toContain('3023226053');
    expect(notice.snippet).toMatch(/Banca Móvil/i);
  });

  it('parses plain Monto without asterisks', () => {
    const notice = parseBankNotice(
      'TRANSFERENCIA\nCuenta Destino: 123\nMonto: 15000\nCanal: App',
    );
    expect(notice.amount).toBe(15000);
    expect(notice.merchant).toBe('123');
  });
});
