import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useDevicePermissions } from './useDevicePermissions';
import { registerDevice, updateLastActivity, syncDevicePermissions } from '@/services/deviceService';
import { getDeviceId } from '@/utils/deviceDetection';
import { supabase } from '@/integrations/supabase/client';

// ✅ Flags globais para prevenir múltiplas chamadas simultâneas
let isRegistering = false;
let registrationPromise: Promise<void> | null = null;

export const useDeviceRegistration = () => {
  const { user, profile } = useAuth();
  const { permissions } = useDevicePermissions();
  const hasRegistered = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // ✅ CRITICAL: Só executar se user E profile existirem
    if (!user || !profile) {
      console.log('⏭️ useDeviceRegistration: Aguardando autenticação completa');
      return;
    }

    // ✅ LOCALSTORAGE com timestamp: prevenir múltiplos registros por 30 minutos
    const registrationKey = `device_reg_v2:${user.id}`;
    const lastRegistration = localStorage.getItem(registrationKey);
    
    // Se já registrou nos últimos 30 minutos, não registrar novamente
    if (lastRegistration) {
      const timeSinceRegistration = Date.now() - parseInt(lastRegistration);
      if (timeSinceRegistration < 30 * 60 * 1000) { // 30 minutos
        console.log('⏭️ Device já registrado nesta sessão, pulando...');
        return;
      }
    }

    // ✅ PREVENIR REGISTRO DUPLICADO na mesma sessão
    if (hasRegistered.current) {
      return;
    }

    // ✅ PREVENIR CHAMADAS SIMULTÂNEAS entre múltiplos hooks
    if (isRegistering) {
      return;
    }

    // ✅ REUSAR PROMISE EXISTENTE SE HOUVER
    if (registrationPromise) {
      registrationPromise.then(() => {
        hasRegistered.current = true;
      });
      return;
    }

    // Registrar dispositivo ao fazer login
    const register = async () => {
      hasRegistered.current = true;
      isRegistering = true;
      
      try {
        // ✅ AGUARDAR propagação do JWT (500ms é suficiente)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ✅ Verificar se ainda está montado
        if (!mountedRef.current) {
          isRegistering = false;
          registrationPromise = null;
          return;
        }
        
        // ✅ Verificar sessão antes de registrar
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('⚠️ Sessão não encontrada, cancelando registro');
          hasRegistered.current = false;
          isRegistering = false;
          registrationPromise = null;
          return;
        }
        
        // ✅ Verificar novamente se está montado antes de continuar
        if (!mountedRef.current) {
          isRegistering = false;
          registrationPromise = null;
          return;
        }
        
        await registerDevice(user.id);
        
        // ✅ Verificar se está montado antes de atualizar localStorage
        if (!mountedRef.current) {
          isRegistering = false;
          registrationPromise = null;
          return;
        }
        
        // ✅ Persist device_id to localStorage after successful registration
        const currentDeviceId = getDeviceId();
        localStorage.setItem('device_id', currentDeviceId);
        
        // Marcar como registrado com timestamp
        localStorage.setItem(registrationKey, Date.now().toString());
        console.log('✅ Dispositivo registrado com sucesso. Device ID:', currentDeviceId);

        // Sincronizar permissões realmente verificadas
        const deviceId = getDeviceId();
        await syncDevicePermissions(deviceId, {
          location: permissions.location === 'granted',
          push: permissions.notifications === 'granted',
          storage: permissions.storage === 'granted'
        });
      } catch (error: any) {
        console.error('❌ Erro ao registrar dispositivo:', {
          message: error?.message,
          code: error?.code,
        });
        
        // ✅ Handle MAX_RETRIES_EXCEEDED gracefully
        if (error?.code === 'MAX_RETRIES_EXCEEDED') {
          console.error('🚫 Device registration failed after maximum retries. User action may be required.');
          // Don't set hasRegistered to false - we don't want to retry indefinitely
          // The user will need to clear localStorage or contact support
        } else {
          // For other errors, allow retry on next mount
          hasRegistered.current = false;
        }
      } finally {
        isRegistering = false;
        registrationPromise = null;
      }
    };

    registrationPromise = register();

    // Atualizar atividade a cada 5 minutos
    const deviceId = getDeviceId();
    const interval = setInterval(() => {
      updateLastActivity(deviceId);
    }, 5 * 60 * 1000); // 5 minutos

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [user?.id, profile?.id]);
};
