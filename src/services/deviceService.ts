import { supabase } from '@/integrations/supabase/client';
import { getDeviceInfo, getDeviceId, resetDeviceId } from '@/utils/deviceDetection';
import { toast } from 'sonner';
import { ErrorMonitoringService } from './errorMonitoringService';

// ✅ Maximum device registration retries to prevent infinite loops
const MAX_DEVICE_REG_RETRIES = 3;

export interface UserDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  user_agent: string | null;
  location_enabled: boolean | null;
  camera_enabled: boolean | null;
  push_enabled: boolean | null;
  microphone_enabled: boolean | null;
  storage_enabled: boolean | null;
  last_active_at: string | null;
  created_at: string | null;
  is_active: boolean | null;
}

// Registrar dispositivo no banco
export const registerDevice = async (userId: string): Promise<UserDevice> => {
  try {
    // ✅ GARANTIR que temos sessão E token válidos
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session || !session.access_token) {
      throw new Error('No valid session found');
    }
    
    // Verificar se o JWT está realmente válido
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser || authUser.id !== userId) {
      throw new Error('Authentication mismatch');
    }
    
    const deviceInfo = await getDeviceInfo();
    const now = new Date().toISOString();
    
    // Try UPDATE first (for existing device owned by this user)
    const { data: updateData, error: updateError } = await supabase
      .from('user_devices')
      .update({
        device_name: deviceInfo.deviceName,
        device_type: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        user_agent: deviceInfo.userAgent,
        last_active_at: now,
        is_active: true,
      })
      .eq('device_id', deviceInfo.deviceId)
      .eq('user_id', authUser.id)
      .select()
      .maybeSingle();
    
    if (updateError) {
      throw updateError;
    }
    
    // If update didn't affect any rows, try INSERT
    if (!updateData) {
      const { data: insertData, error: insertError } = await supabase
        .from('user_devices')
        .insert({
          user_id: authUser.id,
          device_id: deviceInfo.deviceId,
          device_name: deviceInfo.deviceName,
          device_type: deviceInfo.deviceType,
          os: deviceInfo.os,
          browser: deviceInfo.browser,
          user_agent: deviceInfo.userAgent,
          last_active_at: now,
          is_active: true,
        })
        .select()
        .maybeSingle();
      
      if (insertError) {
        // ✅ RETRY se for erro de RLS (JWT não propagado ainda)
        if (insertError.code === '42501') {
          console.warn('⚠️ RLS error - JWT may not be ready. Retrying in 1s...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar sessão novamente
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            throw new Error('Session expired during registration');
          }
          
          // Tentar inserir novamente
          const { data: retryData, error: retryError } = await supabase
            .from('user_devices')
            .insert({
              user_id: authUser.id,
              device_id: deviceInfo.deviceId,
              device_name: deviceInfo.deviceName,
              device_type: deviceInfo.deviceType,
              os: deviceInfo.os,
              browser: deviceInfo.browser,
              user_agent: deviceInfo.userAgent,
              last_active_at: now,
              is_active: true,
            })
            .select()
            .maybeSingle();
          
          if (retryError) throw retryError;
          console.log('✅ Device registered on retry:', retryData);
          return retryData!;
        }
        
        // If device_id conflict with another user, retry with new ID (with limit)
        if (insertError.code === '23505') {
          console.warn('⚠️ Device already registered to another user. Will retry with exponential backoff...');
          
          // ✅ Implement retry logic with exponential backoff
          let retryAttempt = 0;
          let lastError = insertError;
          
          while (retryAttempt < MAX_DEVICE_REG_RETRIES) {
            retryAttempt++;
            
            // Exponential backoff: 1s, 2s, 4s
            const backoffMs = Math.pow(2, retryAttempt - 1) * 1000;
            console.log(`⏳ Retry attempt ${retryAttempt}/${MAX_DEVICE_REG_RETRIES} after ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            
            // Generate new device ID
            const newDeviceId = resetDeviceId();
            console.log(`🆔 Generated new device ID: ${newDeviceId}`);
            
            const retryInfo = { ...deviceInfo, deviceId: newDeviceId };
            
            const { data: retryData, error: retryError } = await supabase
              .from('user_devices')
              .insert({
                user_id: authUser.id,
                device_id: newDeviceId,
                device_name: retryInfo.deviceName,
                device_type: retryInfo.deviceType,
                os: retryInfo.os,
                browser: retryInfo.browser,
                user_agent: retryInfo.userAgent,
                last_active_at: now,
                is_active: true,
              })
              .select()
              .maybeSingle();
            
            if (!retryError && retryData) {
              console.log(`✅ Device registered with new ID on attempt ${retryAttempt}:`, retryData);
              // ✅ Persist new device_id to localStorage after success
              localStorage.setItem('device_id', newDeviceId);
              return retryData;
            }
            
            lastError = retryError;
            
            // If still getting 23505, continue retrying
            if (retryError?.code !== '23505') {
              // Different error, stop retrying
              throw retryError;
            }
          }
          
          // ✅ Max retries exceeded - throw specific error
          const maxRetriesError = new Error(
            `Device registration failed after ${MAX_DEVICE_REG_RETRIES} attempts: Device ID conflicts persist`
          );
          (maxRetriesError as any).code = 'MAX_RETRIES_EXCEEDED';
          (maxRetriesError as any).originalError = lastError;
          throw maxRetriesError;
        }
        throw insertError;
      }
      
      if (!insertData) {
        throw new Error('No data returned from device registration');
      }
      
      console.log('✅ Dispositivo registrado (INSERT):', insertData);
      return insertData;
    }
    
    console.log('✅ Dispositivo registrado (UPDATE):', updateData);
    return updateData;
  } catch (error: any) {
    // Não reportar erro 23505 (conflito de device - esperado em multi-user)
    const is23505Error = error?.code === '23505' || /already registered/i.test(error?.message);
    // Também não reportar MAX_RETRIES_EXCEEDED como erro crítico
    const isMaxRetriesError = error?.code === 'MAX_RETRIES_EXCEEDED';
    
    // ✅ LOG DETALHADO
    console.error('❌ Erro ao registrar dispositivo:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      userId: userId,
      deviceId: getDeviceId(),
      fullError: error,
      willReport: !is23505Error && !isMaxRetriesError
    });
    
    // ✅ ENVIAR PARA TELEGRAM (exceto erro 23505 e MAX_RETRIES_EXCEEDED)
    if (!is23505Error && !isMaxRetriesError) {
      await ErrorMonitoringService.getInstance().captureError(
        new Error(`Device Registration Failed: ${error?.message || 'Unknown error'}`),
        {
          module: 'deviceService',
          functionName: 'registerDevice',
          userId,
          deviceId: getDeviceId(),
          errorCode: error?.code,
          errorDetails: error?.details,
          errorHint: error?.hint
        }
      );
    }
    
    throw error;
  }
};

// Atualizar informações do dispositivo
export const updateDeviceInfo = async (
  deviceId: string,
  updates: Partial<{
    location_enabled: boolean;
    camera_enabled: boolean;
    push_enabled: boolean;
    microphone_enabled: boolean;
    storage_enabled: boolean;
    last_location: string;
  }>
) => {
  try {
    const { error } = await supabase
      .from('user_devices')
      .update({
        ...updates,
        last_active_at: new Date().toISOString(),
      })
      .eq('device_id', deviceId);
    
    if (error) {
      console.error('❌ Erro ao atualizar dispositivo:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar dispositivo:', error);
    return false;
  }
};

// Buscar dispositivos ativos do usuário
export const getActiveDevices = async (profileId: string): Promise<UserDevice[]> => {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', profileId)
      .eq('is_active', true)
      .order('last_active_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar dispositivos:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Erro ao buscar dispositivos:', error);
    return [];
  }
};

// Revogar acesso de um dispositivo
export const revokeDevice = async (deviceId: string) => {
  try {
    const { error } = await supabase
      .from('user_devices')
      .update({ is_active: false })
      .eq('device_id', deviceId);
    
    if (error) {
      console.error('❌ Erro ao revogar dispositivo:', error);
      toast.error('Erro ao revogar dispositivo');
      return false;
    }
    
    toast.success('Dispositivo revogado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao revogar dispositivo:', error);
    toast.error('Erro ao revogar dispositivo');
    return false;
  }
};

// Atualizar última atividade
export const updateLastActivity = async (deviceId: string) => {
  try {
    await supabase
      .from('user_devices')
      .update({ last_active_at: new Date().toISOString() })
      .eq('device_id', deviceId);
  } catch (error) {
    console.error('❌ Erro ao atualizar última atividade:', error);
  }
};

// Sincronizar permissões do dispositivo
export const syncDevicePermissions = async (
  deviceId: string,
  permissions: {
    location?: boolean;
    camera?: boolean;
    push?: boolean;
    microphone?: boolean;
    storage?: boolean;
  }
) => {
  const updates: any = {};
  
  if (permissions.location !== undefined) updates.location_enabled = permissions.location;
  if (permissions.camera !== undefined) updates.camera_enabled = permissions.camera;
  if (permissions.push !== undefined) updates.push_enabled = permissions.push;
  if (permissions.microphone !== undefined) updates.microphone_enabled = permissions.microphone;
  if (permissions.storage !== undefined) updates.storage_enabled = permissions.storage;
  
  return await updateDeviceInfo(deviceId, updates);
};
