import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useActiveFreight } from './useActiveFreight';

export type PermissionRequirement = 'always' | 'when-active' | 'on-demand' | 'recommended' | 'never';

export interface PermissionRules {
  location: PermissionRequirement;
  camera: PermissionRequirement;
  microphone: PermissionRequirement;
  notifications: PermissionRequirement;
  storage: PermissionRequirement;
}

export interface ContextualPermissionInfo {
  rules: PermissionRules;
  shouldRequestLocation: boolean;
  shouldRequestNotifications: boolean;
  shouldShowCameraPrompt: boolean;
  shouldShowMicrophonePrompt: boolean;
  contextMessage: {
    location?: string;
    camera?: string;
    microphone?: string;
    notifications?: string;
  };
}

export const useContextualPermissions = (): ContextualPermissionInfo => {
  const { profile } = useAuth();
  const { hasActiveFreight } = useActiveFreight();

  const rules: PermissionRules = useMemo(() => {
    const role = profile?.role;

    switch (role) {
      case 'MOTORISTA':
      case 'MOTORISTA_AFILIADO':
        return {
          location: 'when-active',
          camera: 'on-demand',
          microphone: 'on-demand',
          notifications: 'recommended',
          storage: 'always'
        };

      case 'TRANSPORTADORA':
        return {
          location: 'never',
          camera: 'on-demand',
          microphone: 'never',
          notifications: 'recommended',
          storage: 'always'
        };

      case 'PRODUTOR':
        return {
          location: 'never',
          camera: 'on-demand',
          microphone: 'never',
          notifications: 'recommended',
          storage: 'always'
        };

      case 'PRESTADOR_SERVICOS':
        return {
          location: 'never',
          camera: 'on-demand',
          microphone: 'on-demand',
          notifications: 'recommended',
          storage: 'always'
        };

      default:
        return {
          location: 'never',
          camera: 'on-demand',
          microphone: 'never',
          notifications: 'recommended',
          storage: 'always'
        };
    }
  }, [profile?.role]);

  const shouldRequestLocation = useMemo(() => {
    if (rules.location === 'never') return false;
    if (rules.location === 'always') return true;
    if (rules.location === 'when-active') return hasActiveFreight;
    return false;
  }, [rules.location, hasActiveFreight]);

  const shouldRequestNotifications = useMemo(() => {
    return rules.notifications === 'recommended';
  }, [rules.notifications]);

  const shouldShowCameraPrompt = useMemo(() => {
    return rules.camera === 'always';
  }, [rules.camera]);

  const shouldShowMicrophonePrompt = useMemo(() => {
    return rules.microphone === 'always';
  }, [rules.microphone]);

  const contextMessage = useMemo(() => {
    const messages: ContextualPermissionInfo['contextMessage'] = {};

    // Mensagem de localização
    if (rules.location === 'when-active') {
      messages.location = hasActiveFreight
        ? '📍 Você tem um frete ativo. A localização é necessária para rastreamento em tempo real.'
        : '📍 A localização será solicitada automaticamente quando você aceitar um frete.';
    } else if (rules.location === 'never') {
      messages.location = '📍 Seu tipo de conta não requer rastreamento de localização.';
    }

    // Mensagem de câmera
    if (rules.camera === 'on-demand') {
      messages.camera = '📸 Será solicitada quando você tirar fotos de documentos ou check-ins.';
    } else if (rules.camera === 'never') {
      messages.camera = '📸 Seu tipo de conta não requer acesso à câmera.';
    }

    // Mensagem de microfone
    if (rules.microphone === 'on-demand') {
      messages.microphone = '🎤 Será solicitada quando você usar chamadas de voz (funcionalidade futura).';
    } else if (rules.microphone === 'never') {
      messages.microphone = '🎤 Seu tipo de conta não requer acesso ao microfone.';
    }

    // Mensagem de notificações
    if (rules.notifications === 'recommended') {
      messages.notifications = '🔔 Recomendado para receber alertas sobre fretes, propostas e mensagens.';
    }

    return messages;
  }, [rules, hasActiveFreight]);

  return {
    rules,
    shouldRequestLocation,
    shouldRequestNotifications,
    shouldShowCameraPrompt,
    shouldShowMicrophonePrompt,
    contextMessage
  };
};
