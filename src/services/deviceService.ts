import { supabase } from '@/integrations/supabase/client';
import { getDeviceInfo, getDeviceId } from '@/utils/deviceDetection';
import { toast } from 'sonner';
import { ErrorMonitoringService } from './errorMonitoringService';

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
    // Get authenticated user to ensure we're using auth.uid()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      throw new Error('User not authenticated');
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
        // If device_id conflict with another user, just log and continue
        if (insertError.code === '23505') {
          console.warn('⚠️ Device already registered to another user');
          throw new Error('This device is already registered to another account');
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
    // ✅ LOG DETALHADO
    console.error('❌ Erro ao registrar dispositivo:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      userId: userId,
      deviceId: getDeviceId(),
      fullError: error
    });
    
    // ✅ ENVIAR PARA TELEGRAM
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
