import { describe, it, expect } from 'vitest';
import { normalizeCity, normalizeCityState, extractAndNormalizeCity } from '../city-normalization';

describe('City Normalization', () => {
  describe('normalizeCity', () => {
    it('should normalize cities with accents', () => {
      expect(normalizeCity('Goiânia')).toBe('goiania');
      expect(normalizeCity('Anápolis')).toBe('anapolis');
      expect(normalizeCity('São Paulo')).toBe('sao paulo');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeCity('CAMPO GRANDE')).toBe('campo grande');
      expect(normalizeCity('campo grande')).toBe('campo grande');
      expect(normalizeCity('Campo Grande')).toBe('campo grande');
    });

    it('should remove special characters', () => {
      expect(normalizeCity("São José d'Oeste")).toBe('sao jose doeste');
      expect(normalizeCity('Três Corações')).toBe('tres coracoes');
    });

    it('should normalize whitespace', () => {
      expect(normalizeCity('  Alta  Floresta  ')).toBe('alta floresta');
      expect(normalizeCity('Campo   Grande')).toBe('campo grande');
    });

    it('should handle empty and null values', () => {
      expect(normalizeCity('')).toBe('');
      expect(normalizeCity(null as any)).toBe('');
      expect(normalizeCity(undefined as any)).toBe('');
    });
  });

  describe('normalizeCityState', () => {
    it('should normalize city|state format', () => {
      expect(normalizeCityState('Goiânia', 'GO')).toBe('goiania|GO');
      expect(normalizeCityState('Campo Grande', 'MS')).toBe('campo grande|MS');
      expect(normalizeCityState('Anápolis', 'GO')).toBe('anapolis|GO');
    });

    it('should handle lowercase state', () => {
      expect(normalizeCityState('Uberaba', 'mg')).toBe('uberaba|MG');
      expect(normalizeCityState('Alta Floresta', 'mt')).toBe('alta floresta|MT');
    });

    it('should handle missing state', () => {
      expect(normalizeCityState('Goiânia', '')).toBe('goiania');
      expect(normalizeCityState('Campo Grande', null as any)).toBe('campo grande');
    });

    it('should match real-world examples from logs', () => {
      // Examples from actual logs that were being discarded
      expect(normalizeCityState('goiânia', 'GO')).toBe('goiania|GO');
      expect(normalizeCityState('campo grande', 'MS')).toBe('campo grande|MS');
      expect(normalizeCityState('alta floresta', 'MT')).toBe('alta floresta|MT');
      expect(normalizeCityState('uberaba', 'MG')).toBe('uberaba|MG');
      expect(normalizeCityState('anápolis', 'GO')).toBe('anapolis|GO');
    });
  });

  describe('extractAndNormalizeCity', () => {
    it('should extract city from full address', () => {
      expect(extractAndNormalizeCity('Rua X, 123 - Goiânia, GO')).toBe('goiania');
      expect(extractAndNormalizeCity('Av. Principal - Campo Grande, MS')).toBe('campo grande');
    });

    it('should handle address with state at end', () => {
      expect(extractAndNormalizeCity('Centro, Anápolis - GO')).toBe('anapolis');
      expect(extractAndNormalizeCity('Centro, Alta Floresta, MT')).toBe('alta floresta');
    });

    it('should handle simple city name', () => {
      expect(extractAndNormalizeCity('Goiânia')).toBe('goiania');
      expect(extractAndNormalizeCity('CAMPO GRANDE')).toBe('campo grande');
    });

    it('should handle empty values', () => {
      expect(extractAndNormalizeCity('')).toBe('');
      expect(extractAndNormalizeCity(null as any)).toBe('');
    });
  });

  describe('Real-world matching scenarios', () => {
    it('should match cities regardless of accent variations', () => {
      const variants = [
        'Goiânia',
        'goiania',
        'GOIÂNIA',
        'Goiania',
      ];
      
      const normalized = variants.map(v => normalizeCity(v));
      const unique = new Set(normalized);
      
      expect(unique.size).toBe(1);
      expect(unique.has('goiania')).toBe(true);
    });

    it('should match full city|state format', () => {
      const active = normalizeCityState('campo grande', 'MS');
      const freight1 = normalizeCityState('Campo Grande', 'MS');
      const freight2 = normalizeCityState('CAMPO GRANDE', 'MS');
      
      expect(active).toBe(freight1);
      expect(active).toBe(freight2);
    });

    it('should enable fallback matching by city only', () => {
      // Driver has "primavera do leste|MT"
      const driverCity = normalizeCityState('primavera do leste', 'MT');
      
      // Freight has "Primavera do Leste" without state or different case
      const freightCityOnly = normalizeCity('Primavera do Leste');
      const driverCityOnly = driverCity.split('|')[0];
      
      expect(driverCityOnly).toBe(freightCityOnly);
    });
  });
});
