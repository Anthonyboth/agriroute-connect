/**
 * Hook centralizado para corredores rodoviários.
 * Mapeia cada corredor para cidades de origem/destino com IDs reais do banco.
 * Ordenado por volume de tráfego (mais trafegado primeiro).
 */
import { useMemo } from 'react';

export interface CorridorCity {
  name: string;
  state: string;
  cityId: string;
  lat: number;
  lng: number;
}

export interface RouteCorridor {
  id: string;
  label: string;
  origin: CorridorCity;
  destination: CorridorCity;
  /** Estimated traffic volume for sorting (higher = more trafficked) */
  trafficScore: number;
}

/**
 * Returns all route corridors sorted by traffic score (most trafficked first).
 */
export function useRouteCorridors() {
  const corridors = useMemo<RouteCorridor[]>(() => [
    {
      id: 'BR163-CBA-STM',
      label: 'BR-163 (Cuiabá → Santarém)',
      origin: { name: 'Cuiabá', state: 'MT', cityId: 'b5a91d94-7472-420b-97df-11d39672eca0', lat: -15.60, lng: -56.10 },
      destination: { name: 'Santarém', state: 'PA', cityId: '5efcfdc3-1127-4028-a0d4-d08e2f45d799', lat: -2.44, lng: -54.71 },
      trafficScore: 100,
    },
    {
      id: 'BR163-RDN-SNP',
      label: 'BR-163 (Rondonópolis → Sinop)',
      origin: { name: 'Rondonópolis', state: 'MT', cityId: 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', lat: -16.47, lng: -54.64 },
      destination: { name: 'Sinop', state: 'MT', cityId: '34cc76dd-0659-46ac-aa2e-33a846c9b1d7', lat: -11.86, lng: -55.51 },
      trafficScore: 95,
    },
    {
      id: 'BR163-SRS-SNP',
      label: 'BR-163 (Sorriso → Sinop)',
      origin: { name: 'Sorriso', state: 'MT', cityId: '0a3e0bf1-9562-41c2-bbf3-1ffd80f47869', lat: -12.55, lng: -55.72 },
      destination: { name: 'Sinop', state: 'MT', cityId: '34cc76dd-0659-46ac-aa2e-33a846c9b1d7', lat: -11.86, lng: -55.51 },
      trafficScore: 90,
    },
    {
      id: 'BR364-CBA-PVH',
      label: 'BR-364 (Cuiabá → Porto Velho)',
      origin: { name: 'Cuiabá', state: 'MT', cityId: 'b5a91d94-7472-420b-97df-11d39672eca0', lat: -15.60, lng: -56.10 },
      destination: { name: 'Porto Velho', state: 'RO', cityId: '79a6f101-2524-4fc4-9a00-1d1b6024674c', lat: -8.76, lng: -63.90 },
      trafficScore: 88,
    },
    {
      id: 'BR364-RDN-CBA',
      label: 'BR-364 (Rondonópolis → Cuiabá)',
      origin: { name: 'Rondonópolis', state: 'MT', cityId: 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', lat: -16.47, lng: -54.64 },
      destination: { name: 'Cuiabá', state: 'MT', cityId: 'b5a91d94-7472-420b-97df-11d39672eca0', lat: -15.60, lng: -56.10 },
      trafficScore: 85,
    },
    {
      id: 'BR070-BSB-CBA',
      label: 'BR-070 (Brasília → Cuiabá)',
      origin: { name: 'Brasília', state: 'DF', cityId: 'ea521563-749e-49bf-b624-eda08f210e3a', lat: -15.78, lng: -47.93 },
      destination: { name: 'Cuiabá', state: 'MT', cityId: 'b5a91d94-7472-420b-97df-11d39672eca0', lat: -15.60, lng: -56.10 },
      trafficScore: 82,
    },
    {
      id: 'BR158-BDG-RDN',
      label: 'BR-158 (Barra do Garças → Redenção)',
      origin: { name: 'Barra do Garças', state: 'MT', cityId: 'bc59b822-d248-48da-8cc7-8a60c36dc7c7', lat: -15.89, lng: -52.26 },
      destination: { name: 'Redenção', state: 'PA', cityId: 'dfc6fbcd-c6ac-4223-8904-789ecc3ce4dc', lat: -8.03, lng: -50.03 },
      trafficScore: 78,
    },
    {
      id: 'MT-SNP-AF',
      label: 'MT (Sinop → Alta Floresta)',
      origin: { name: 'Sinop', state: 'MT', cityId: '34cc76dd-0659-46ac-aa2e-33a846c9b1d7', lat: -11.86, lng: -55.51 },
      destination: { name: 'Alta Floresta', state: 'MT', cityId: '397440ce-8de7-44cf-8e91-f6d7149f9410', lat: -9.88, lng: -56.09 },
      trafficScore: 75,
    },
    {
      id: 'BR163-LRV-SRS',
      label: 'BR-163 (Lucas do Rio Verde → Sorriso)',
      origin: { name: 'Lucas do Rio Verde', state: 'MT', cityId: '41adf657-6155-4e82-ad5e-65860e3fb7a8', lat: -13.05, lng: -55.91 },
      destination: { name: 'Sorriso', state: 'MT', cityId: '0a3e0bf1-9562-41c2-bbf3-1ffd80f47869', lat: -12.55, lng: -55.72 },
      trafficScore: 72,
    },
    {
      id: 'BR242-BSB-BAR',
      label: 'BR-242 (Brasília → Barreiras)',
      origin: { name: 'Brasília', state: 'DF', cityId: 'ea521563-749e-49bf-b624-eda08f210e3a', lat: -15.78, lng: -47.93 },
      destination: { name: 'Barreiras', state: 'BA', cityId: 'd3c4a8c8-db5c-4392-96f5-87b23f8cc931', lat: -12.15, lng: -44.99 },
      trafficScore: 70,
    },
    {
      id: 'BR135-BSB-BLS',
      label: 'BR-135 (Brasília → Balsas)',
      origin: { name: 'Brasília', state: 'DF', cityId: 'ea521563-749e-49bf-b624-eda08f210e3a', lat: -15.78, lng: -47.93 },
      destination: { name: 'Balsas', state: 'MA', cityId: 'b334f391-f976-4242-89b4-d2ec98166ceb', lat: -7.53, lng: -46.04 },
      trafficScore: 68,
    },
    {
      id: 'MT-PLE-RDN',
      label: 'MT (Primavera do Leste → Rondonópolis)',
      origin: { name: 'Primavera do Leste', state: 'MT', cityId: '72e2661e-0ffc-4d4f-a032-004edd82a0d8', lat: -15.56, lng: -54.30 },
      destination: { name: 'Rondonópolis', state: 'MT', cityId: 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', lat: -16.47, lng: -54.64 },
      trafficScore: 65,
    },
    {
      id: 'BR163-SNP-CGR',
      label: 'BR-163 (Sinop → Campo Grande)',
      origin: { name: 'Sinop', state: 'MT', cityId: '34cc76dd-0659-46ac-aa2e-33a846c9b1d7', lat: -11.86, lng: -55.51 },
      destination: { name: 'Campo Grande', state: 'MS', cityId: '237f89ea-0199-4d77-a013-c10312259f0d', lat: -20.44, lng: -54.65 },
      trafficScore: 62,
    },
    {
      id: 'MT-SRS-GOI',
      label: 'MT→GO (Sorriso → Goiânia)',
      origin: { name: 'Sorriso', state: 'MT', cityId: '0a3e0bf1-9562-41c2-bbf3-1ffd80f47869', lat: -12.55, lng: -55.72 },
      destination: { name: 'Goiânia', state: 'GO', cityId: '6079766a-e950-4c96-8bbe-2cf74a04e0e8', lat: -16.69, lng: -49.25 },
      trafficScore: 60,
    },
    {
      id: 'BR163-CBA-DRD',
      label: 'BR-163 (Cuiabá → Dourados)',
      origin: { name: 'Cuiabá', state: 'MT', cityId: 'b5a91d94-7472-420b-97df-11d39672eca0', lat: -15.60, lng: -56.10 },
      destination: { name: 'Dourados', state: 'MS', cityId: '6a78dd6d-ba67-4662-93c1-4427d04e6457', lat: -22.22, lng: -54.81 },
      trafficScore: 55,
    },
    {
      id: 'CARAJAS-MRB',
      label: 'Corredor Carajás (Marabá → Redenção)',
      origin: { name: 'Marabá', state: 'PA', cityId: 'aa868a01-5b9f-4bec-8255-f2eecac49703', lat: -5.37, lng: -49.13 },
      destination: { name: 'Redenção', state: 'PA', cityId: 'dfc6fbcd-c6ac-4223-8904-789ecc3ce4dc', lat: -8.03, lng: -50.03 },
      trafficScore: 50,
    },
  ], []);

  /** Just the labels for simple select dropdowns */
  const corridorLabels = useMemo(() => corridors.map(c => c.label), [corridors]);

  /** Find a corridor by its label string */
  const findByLabel = (label: string) => corridors.find(c => c.label === label);

  /** Find a corridor by its id */
  const findById = (id: string) => corridors.find(c => c.id === id);

  return { corridors, corridorLabels, findByLabel, findById };
}
