import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeForDisplaySafe, sanitizeInput, isValidCoordinate } from '@/lib/validation';

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    expect(sanitizeHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('removes event handlers', () => {
    expect(sanitizeHtml('<img onerror=alert(1) />')).not.toContain('onerror');
  });

  it('removes javascript: protocol', () => {
    expect(sanitizeHtml('javascript:alert(1)')).not.toContain('javascript:');
  });

  it('keeps clean text', () => {
    expect(sanitizeHtml('João da Silva')).toBe('João da Silva');
  });
});

describe('sanitizeForDisplaySafe', () => {
  it('removes HTML and control characters', () => {
    const malicious = '<img src=x onerror=alert(1)>\x00Hello';
    const result = sanitizeForDisplaySafe(malicious);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('\x00');
    expect(result).toContain('Hello');
  });

  it('handles empty string', () => {
    expect(sanitizeForDisplaySafe('')).toBe('');
  });

  it('handles normal Brazilian names', () => {
    expect(sanitizeForDisplaySafe('José da Silva')).toBe('José da Silva');
  });
});

describe('sanitizeInput', () => {
  it('removes control characters', () => {
    expect(sanitizeInput('Hello\x00World')).toBe('HelloWorld');
  });

  it('truncates long input', () => {
    const longString = 'a'.repeat(20000);
    expect(sanitizeInput(longString).length).toBe(10000);
  });
});

describe('isValidCoordinate', () => {
  it('rejects 0,0', () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidCoordinate(NaN, -47)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isValidCoordinate(Infinity, -47)).toBe(false);
  });

  it('rejects coordinates outside Brazil', () => {
    expect(isValidCoordinate(40.7128, -74.006)).toBe(false); // New York
    expect(isValidCoordinate(48.8566, 2.3522)).toBe(false); // Paris
  });

  it('accepts valid Brazilian coordinates', () => {
    expect(isValidCoordinate(-23.5505, -46.6333)).toBe(true); // São Paulo
    expect(isValidCoordinate(-15.7801, -47.9292)).toBe(true); // Brasília
    expect(isValidCoordinate(-22.9068, -43.1729)).toBe(true); // Rio de Janeiro
    expect(isValidCoordinate(-3.1190, -60.0217)).toBe(true);  // Manaus
  });

  it('accepts coordinates at Brazil borders', () => {
    expect(isValidCoordinate(-33.0, -53.0)).toBe(true); // Southern Brazil
    expect(isValidCoordinate(4.0, -60.0)).toBe(true);    // Northern Brazil
  });
});
