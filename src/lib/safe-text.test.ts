import { describe, it, expect } from 'vitest';
import { safeText, formatBRL, truncateText, safeDisplayLocation } from './safe-text';

describe('safeText', () => {
  it('returns fallback for null', () => {
    expect(safeText(null)).toBe('Não informado');
  });

  it('returns fallback for undefined', () => {
    expect(safeText(undefined)).toBe('Não informado');
  });

  it('returns fallback for empty string', () => {
    expect(safeText('')).toBe('Não informado');
  });

  it('returns fallback for whitespace-only string', () => {
    expect(safeText('   ')).toBe('Não informado');
  });

  it('trims whitespace', () => {
    expect(safeText('  hello world  ')).toBe('hello world');
  });

  it('removes control characters', () => {
    expect(safeText('hello\x00world')).toBe('helloworld');
  });

  it('converts numbers to string', () => {
    expect(safeText(123)).toBe('123');
  });

  it('uses custom fallback', () => {
    expect(safeText(null, 'N/A')).toBe('N/A');
  });
});

describe('formatBRL', () => {
  it('formats positive numbers', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56');
  });

  it('formats zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
  });

  it('handles null', () => {
    expect(formatBRL(null)).toBe('R$ 0,00');
  });

  it('handles undefined', () => {
    expect(formatBRL(undefined)).toBe('R$ 0,00');
  });

  it('formats without decimals when specified', () => {
    expect(formatBRL(1234.56, false)).toBe('R$ 1.235');
  });
});

describe('truncateText', () => {
  it('does not truncate short text', () => {
    const result = truncateText('Hello', 100);
    expect(result.text).toBe('Hello');
    expect(result.isTruncated).toBe(false);
  });

  it('truncates long text at word boundary', () => {
    const result = truncateText('Hello world this is a long text', 15);
    expect(result.text).toBe('Hello world...');
    expect(result.isTruncated).toBe(true);
  });

  it('handles empty text', () => {
    const result = truncateText('', 100);
    expect(result.text).toBe('');
    expect(result.isTruncated).toBe(false);
  });
});

describe('safeDisplayLocation', () => {
  it('returns city and state when both provided', () => {
    expect(safeDisplayLocation('São Paulo', 'SP')).toBe('São Paulo, SP');
  });

  it('returns city only when state is missing', () => {
    expect(safeDisplayLocation('São Paulo', null)).toBe('São Paulo');
  });

  it('extracts city from address format', () => {
    expect(safeDisplayLocation(null, null, 'Rua X, 123, São Paulo, SP'))
      .toBe('São Paulo, SP');
  });

  it('returns fallback when nothing provided', () => {
    expect(safeDisplayLocation(null, null, null))
      .toBe('Localização não especificada');
  });
});
