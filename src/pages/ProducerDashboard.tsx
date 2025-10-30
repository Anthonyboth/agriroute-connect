  const confirmCancelFreight = async () => {
    if (!freightToCancel) return;
    
    // Validar se pode cancelar diretamente
    const canCancelDirectly = ['OPEN', 'ACCEPTED', 'LOADING'].includes(freightToCancel.status);
    
    if (!canCancelDirectly) {
      toast.error('Este frete está em andamento. Solicite o cancelamento via chat com o motorista.');
      setConfirmDialogOpen(false);
      return;
    }
    
    console.log('[FREIGHT-CANCEL] ========== STARTING CANCELLATION ==========');
    console.log('[FREIGHT-CANCEL] Freight ID:', freightToCancel.id);
    console.log('[FREIGHT-CANCEL] Freight Status:', freightToCancel.status);
    console.log('[FREIGHT-CANCEL] User Profile ID:', profile?.id);
    console.log('[FREIGHT-CANCEL] Timestamp:', new Date().toISOString());
    
    try {
      // Use safe edge function to handle pickup_date validation
      console.log('[FREIGHT-CANCEL] Invoking cancel-freight-safe edge function...');
      const { data, error } = await supabase.functions.invoke('cancel-freight-safe', {
        body: {
          freight_id: freightToCancel.id,
          reason: 'Cancelado pelo produtor'
        }
      });

      console.log('[FREIGHT-CANCEL] Edge function response:', { data, error });

      if (error) {
        console.error('[FREIGHT-CANCEL] ❌ Edge function returned error');
        console.error('[FREIGHT-CANCEL] Error object:', JSON.stringify(error, null, 2));
        console.error('[FREIGHT-CANCEL] Error name:', error.name);
        console.error('[FREIGHT-CANCEL] Error message:', error.message);
        console.error('[FREIGHT-CANCEL] Error context:', error.context);
        
        // Try to extract more details from the error
        let errorMessage = 'Erro ao cancelar frete';
        let errorDetails = '';
        
        if (error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            
            console.error('[FREIGHT-CANCEL] Error body parsed:', errorBody);
            
            if (errorBody.error) errorMessage = errorBody.error;
            if (errorBody.error_code) errorDetails += `Código: ${errorBody.error_code}. `;
            if (errorBody.details) errorDetails += errorBody.details;
            
            console.error('[FREIGHT-CANCEL] Error code:', errorBody.error_code);
            console.error('[FREIGHT-CANCEL] Error details:', errorBody.details);
          } catch (parseError) {
            console.error('[FREIGHT-CANCEL] Failed to parse error body:', parseError);
          }
        }
        
        // Display user-friendly error message with details
        if (errorDetails) {
          toast.error(errorMessage, {
            description: errorDetails,
            duration: 5000
          });
        } else {
          toast.error(errorMessage);
        }
        
        throw error;
      }

      console.log('[FREIGHT-CANCEL] Data response:', JSON.stringify(data, null, 2));

      if (!data?.success) {
        console.error('[FREIGHT-CANCEL] ❌ Edge function did not return success');
        console.error('[FREIGHT-CANCEL] Response data:', data);
        
        const errorMsg = data?.error || 'Erro ao cancelar frete';
        const errorCode = data?.error_code || 'UNKNOWN';
        const errorDetails = data?.details || '';
        
        console.error('[FREIGHT-CANCEL] Error code:', errorCode);
        console.error('[FREIGHT-CANCEL] Error details:', errorDetails);
        
        if (errorDetails) {
          toast.error(errorMsg, {
            description: `${errorCode}: ${errorDetails}`,
            duration: 5000
          });
        } else {
          toast.error(errorMsg);
        }
        
        throw new Error(errorMsg);
      }

      console.log('[FREIGHT-CANCEL] ✅ Freight cancelled successfully');

      // Notificar motorista se houver um assignado
      if (freightToCancel.driver_id) {
        console.log('[FREIGHT-CANCEL] Sending notification to driver...');
        await supabase.functions.invoke('send-notification', {
          body: {
            user_id: freightToCancel.driver_profiles?.user_id,
            title: 'Frete Cancelado',
            message: `O frete de ${freightToCancel.cargo_type} foi cancelado pelo produtor.`,
            type: 'freight_cancelled',
            data: { freight_id: freightToCancel.id }
          }
        }).catch(err => {
          console.warn('[FREIGHT-CANCEL] Notification failed (non-critical):', err);
        });
      }

      toast.success('Frete cancelado com sucesso!');
      setConfirmDialogOpen(false);
      setFreightToCancel(null);
      
      console.log('[FREIGHT-CANCEL] Refreshing freight list...');
      fetchFreights();
      console.log('[FREIGHT-CANCEL] ========== CANCELLATION COMPLETED ==========');
      
    } catch (error: any) {
      console.error('[FREIGHT-CANCEL] ❌ ========== CANCELLATION FAILED ==========');
      console.error('[FREIGHT-CANCEL] Caught error:', error);
      console.error('[FREIGHT-CANCEL] Error type:', typeof error);
      console.error('[FREIGHT-CANCEL] Error keys:', Object.keys(error));
      console.error('[FREIGHT-CANCEL] Error stringified:', JSON.stringify(error, null, 2));
      
      // Only show toast if we haven't already shown one above
      if (!error.context) {
        toast.error(error.message || 'Erro ao cancelar frete');
      }
    }
  };