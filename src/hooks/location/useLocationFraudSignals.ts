/**
 * useLocationFraudSignals
 *
 * Analisa sinais de risco antifraude baseados em localização:
 *   - Velocidade impossível (> 160 km/h em área rural)
 *   - Saltos geográficos gigantes
 *   - GPS "congelado" (posição idêntica repetida)
 *   - Accuracy ruim por longo período
 *
 * Salva no banco quando riskLevel = HIGH (para auditoria antifraude).
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LocationCoords } from './useLocationSecurityMonitor';

export type FraudRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FraudSignals {
  riskLevel: FraudRiskLevel;
  reasons: string[];
}

const MAX_SPEED_KMH = 160;           // Velocidade máxima aceitável
const MAX_JUMP_KM = 50;              // Salto máximo em 1 minuto
const MIN_MOVEMENT_M = 5;            // Mínimo de movimento para não ser "congelado"
const FROZEN_THRESHOLD_MINS = 10;    // Minutos sem movimento antes de sinalizar
const HIGH_ACC_THRESHOLD_MINS = 15;  // Minutos com accuracy ruim antes de sinalizar

interface PositionRecord {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

/** Haversine em km */
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface UseLocationFraudSignalsOptions {
  freightId: string | null;
  driverProfileId: string | null;
}

export const useLocationFraudSignals = ({
  freightId,
  driverProfileId,
}: UseLocationFraudSignalsOptions) => {
  const historyRef = useRef<PositionRecord[]>([]);
  const highAccuracyStartRef = useRef<number | null>(null);

  const analyze = useCallback(async (coords: LocationCoords): Promise<FraudSignals> => {
    const reasons: string[] = [];
    const history = historyRef.current;
    const now = coords.timestamp;

    // Rastrear accuracy ruim contínua
    if (coords.accuracy > 150) {
      if (!highAccuracyStartRef.current) highAccuracyStartRef.current = now;
      const highAccMins = (now - highAccuracyStartRef.current) / 60000;
      if (highAccMins > HIGH_ACC_THRESHOLD_MINS) {
        reasons.push(`Accuracy > 150m por ${highAccMins.toFixed(0)} minutos`);
      }
    } else {
      highAccuracyStartRef.current = null;
    }

    if (history.length > 0) {
      const prev = history[history.length - 1];
      const distKm = haversineKm(prev.lat, prev.lng, coords.lat, coords.lng);
      const elapsedMs = now - prev.timestamp;
      const elapsedH = elapsedMs / 3600000;

      // Velocidade impossível
      if (elapsedH > 0 && distKm > 0.1) {
        const speedKmh = distKm / elapsedH;
        if (speedKmh > MAX_SPEED_KMH) {
          reasons.push(`Velocidade impossível: ${speedKmh.toFixed(0)} km/h`);
        }
      }

      // Salto geográfico gigante
      if (distKm > MAX_JUMP_KM && elapsedMs < 120000) {
        reasons.push(`Salto geográfico: ${distKm.toFixed(1)} km em ${(elapsedMs / 1000).toFixed(0)}s`);
      }

      // GPS "congelado" — posição idêntica por muito tempo
      const recentHistory = history.filter(p => now - p.timestamp < FROZEN_THRESHOLD_MINS * 60000);
      if (recentHistory.length >= 5) {
        const allClose = recentHistory.every(p =>
          haversineKm(p.lat, p.lng, coords.lat, coords.lng) * 1000 < MIN_MOVEMENT_M
        );
        if (allClose) {
          reasons.push(`GPS congelado — sem movimento por ${FROZEN_THRESHOLD_MINS} minutos`);
        }
      }
    }

    // Manter histórico dos últimos 30 minutos
    const THIRTY_MINS = 30 * 60 * 1000;
    historyRef.current = [
      ...history.filter(p => now - p.timestamp < THIRTY_MINS),
      { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy, timestamp: now },
    ].slice(-100); // máximo 100 pontos

    const riskLevel: FraudRiskLevel =
      reasons.length >= 2 ? 'HIGH' : reasons.length === 1 ? 'MEDIUM' : 'LOW';

    // Salvar no banco se risco alto
    if (riskLevel === 'HIGH' && freightId && driverProfileId) {
      try {
        await supabase.from('auditoria_eventos').insert({
          tipo: 'ANTIFRAUDE_GPS',
          codigo_regra: 'GPS_FRAUD_SIGNALS',
          descricao: `Sinais de fraude GPS detectados: ${reasons.join('; ')}`,
          severidade: 'HIGH',
          frete_id: freightId,
          evidencias: {
            reasons,
            coords: { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy },
            timestamp: new Date(coords.timestamp).toISOString(),
            driver_profile_id: driverProfileId,
          },
        });
      } catch (err) {
        console.error('[GPS-Fraud] Erro ao salvar evento de auditoria:', err);
      }
    }

    return { riskLevel, reasons };
  }, [freightId, driverProfileId]);

  const reset = useCallback(() => {
    historyRef.current = [];
    highAccuracyStartRef.current = null;
  }, []);

  return { analyze, reset };
};
