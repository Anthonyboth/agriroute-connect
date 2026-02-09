import React from 'react';
import { Truck, User, MapPin, ClipboardList, Check, Wrench, Tractor, Package, Home, Bike, PawPrint, Box } from 'lucide-react';
import { ServiceType, ServiceWizardConfig, ServiceWizardStep } from './types';

const createBaseSteps = (step4Title: string = 'Detalhes'): ServiceWizardStep[] => [
  { id: 1, title: 'Serviço', description: 'Tipo e problema', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
  { id: 3, title: 'Localização', description: 'Endereços', icon: <MapPin className="h-4 w-4" /> },
  { id: 4, title: step4Title, description: 'Especificações', icon: <Package className="h-4 w-4" /> },
  { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
];

export const SERVICE_WIZARD_CONFIGS: Record<ServiceType, ServiceWizardConfig> = {
  GUINCHO: {
    serviceType: 'GUINCHO',
    title: 'Solicitar Guincho',
    description: 'Reboque e socorro 24h para qualquer tipo de veículo',
    icon: '🚛',
    requiresDestination: true, // Guincho precisa de destino (para onde levar o veículo)
    category: 'urban',
    steps: [
      { id: 1, title: 'Situação', description: 'Tipo de problema', icon: <Truck className="h-4 w-4" /> },
      { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
      { id: 3, title: 'Localização', description: 'Onde está', icon: <MapPin className="h-4 w-4" /> },
      { id: 4, title: 'Veículo', description: 'Detalhes', icon: <Truck className="h-4 w-4" /> },
      { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
    ],
  },
  FRETE_MOTO: {
    serviceType: 'FRETE_MOTO',
    title: 'Frete por Moto',
    description: 'Entregas rápidas até 150kg com moto',
    icon: '🏍️',
    requiresDestination: true,
    category: 'urban',
    steps: createBaseSteps('Carga'),
  },
  FRETE_URBANO: {
    serviceType: 'FRETE_URBANO',
    title: 'Frete Urbano',
    description: 'Transporte de objetos até 1.5 tonelada',
    icon: '📦',
    requiresDestination: true,
    category: 'urban',
    steps: createBaseSteps('Carga'),
  },
  ENTREGA_PACOTES: {
    serviceType: 'ENTREGA_PACOTES',
    title: 'Entrega de Pacotes',
    description: 'Entrega rápida de encomendas e documentos',
    icon: '📬',
    requiresDestination: true,
    category: 'freight',
    steps: [
      { id: 1, title: 'Pacote', description: 'O que enviar', icon: <Box className="h-4 w-4" /> },
      { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
      { id: 3, title: 'Endereços', description: 'Coleta e entrega', icon: <MapPin className="h-4 w-4" /> },
      { id: 4, title: 'Detalhes', description: 'Peso e prazo', icon: <Package className="h-4 w-4" /> },
      { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
    ],
  },
  TRANSPORTE_PET: {
    serviceType: 'TRANSPORTE_PET',
    title: 'Transporte de Pet',
    description: 'Viagem segura e confortável para seu pet 🐾',
    icon: '🐾',
    requiresDestination: true,
    category: 'freight',
    steps: [
      { id: 1, title: 'Seu Pet', description: 'Informações', icon: <PawPrint className="h-4 w-4" /> },
      { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
      { id: 3, title: 'Endereços', description: 'Coleta e destino', icon: <MapPin className="h-4 w-4" /> },
      { id: 4, title: 'Detalhes', description: 'Cuidados', icon: <PawPrint className="h-4 w-4" /> },
      { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
    ],
  },
  MUDANCA_RESIDENCIAL: {
    serviceType: 'MUDANCA_RESIDENCIAL',
    title: 'Mudança Residencial',
    description: 'Casa ou apartamento completo',
    icon: '🏠',
    requiresDestination: true,
    category: 'urban',
    steps: [
      { id: 1, title: 'Tipo', description: 'Sobre a mudança', icon: <Home className="h-4 w-4" /> },
      { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
      { id: 3, title: 'Endereços', description: 'Origem e destino', icon: <MapPin className="h-4 w-4" /> },
      { id: 4, title: 'Serviços', description: 'Adicionais', icon: <Package className="h-4 w-4" /> },
      { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
    ],
  },
  MUDANCA_COMERCIAL: {
    serviceType: 'MUDANCA_COMERCIAL',
    title: 'Mudança Comercial',
    description: 'Escritórios e lojas',
    icon: '🏢',
    requiresDestination: true,
    category: 'urban',
    steps: [
      { id: 1, title: 'Tipo', description: 'Sobre a mudança', icon: <Home className="h-4 w-4" /> },
      { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
      { id: 3, title: 'Endereços', description: 'Origem e destino', icon: <MapPin className="h-4 w-4" /> },
      { id: 4, title: 'Serviços', description: 'Adicionais', icon: <Package className="h-4 w-4" /> },
      { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
    ],
  },
  SERVICO_AGRICOLA: {
    serviceType: 'SERVICO_AGRICOLA',
    title: 'Serviço Agrícola',
    description: 'Análise, plantio, colheita e mais',
    icon: '🌾',
    requiresDestination: false,
    category: 'agricultural',
    steps: [
      { id: 1, title: 'Serviço', description: 'O que precisa', icon: <Tractor className="h-4 w-4" /> },
      { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
      { id: 3, title: 'Propriedade', description: 'Localização', icon: <MapPin className="h-4 w-4" /> },
      { id: 4, title: 'Detalhes', description: 'Especificações', icon: <ClipboardList className="h-4 w-4" /> },
      { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
    ],
  },
  SERVICO_TECNICO: {
    serviceType: 'SERVICO_TECNICO',
    title: 'Serviço Técnico',
    description: 'Manutenção e reparos de equipamentos',
    icon: '🔧',
    requiresDestination: false,
    category: 'technical',
    steps: [
      { id: 1, title: 'Problema', description: 'O que precisa', icon: <Wrench className="h-4 w-4" /> },
      { id: 2, title: 'Seus Dados', description: 'Contato', icon: <User className="h-4 w-4" /> },
      { id: 3, title: 'Local', description: 'Onde está', icon: <MapPin className="h-4 w-4" /> },
      { id: 4, title: 'Equipamento', description: 'Detalhes', icon: <Wrench className="h-4 w-4" /> },
      { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
    ],
  },
};

export const getServiceConfig = (serviceType: ServiceType): ServiceWizardConfig => {
  return SERVICE_WIZARD_CONFIGS[serviceType];
};

export const SUB_SERVICE_OPTIONS = {
  GUINCHO: [
    { id: 'GUINCHO_CARRO', name: 'Carro', description: 'Veículo de passeio' },
    { id: 'GUINCHO_MOTO', name: 'Moto', description: 'Motocicleta' },
    { id: 'GUINCHO_VAN', name: 'Van/Utilitário', description: 'Veículo utilitário' },
    { id: 'GUINCHO_CAMINHAO', name: 'Caminhão', description: 'Veículo pesado' },
  ],
  VEHICLE_SITUATIONS: [
    { id: 'NAO_LIGA', name: 'Não liga', description: 'Veículo sem bateria ou problema elétrico' },
    { id: 'ACIDENTE', name: 'Acidente', description: 'Veículo danificado por colisão' },
    { id: 'PNEU_FURADO', name: 'Pneu furado', description: 'Problema com pneu' },
    { id: 'QUEBRA_MECANICA', name: 'Quebra mecânica', description: 'Problema no motor ou transmissão' },
    { id: 'OUTRO', name: 'Outro', description: 'Outro problema' },
  ],
  ROOMS: [
    { value: '1', label: '1 cômodo (Kitnet)' },
    { value: '2', label: '2 cômodos' },
    { value: '3', label: '3 cômodos' },
    { value: '4', label: '4 cômodos' },
    { value: '5', label: '5 cômodos' },
    { value: '6+', label: '6+ cômodos' },
  ],
};
