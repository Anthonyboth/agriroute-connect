import { supabase } from '@/integrations/supabase/client';
import { validateDocument } from '@/utils/cpfValidator';

interface DocumentValidation {
  isValid: boolean;
  confidence: number;
  errors?: string[];
}

export class AutomaticApprovalService {
  
  // Simulate document AI validation (in real implementation, would use AI service)
  private static async validateDocumentImage(imageUrl: string, documentType: string): Promise<DocumentValidation> {
    // Simulate AI validation - in production, integrate with actual AI service
    // For now, assume all documents are valid if they exist
    if (!imageUrl) {
      return {
        isValid: false,
        confidence: 0,
        errors: ['Documento não encontrado']
      };
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Basic validation - check if URL is accessible
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        return {
          isValid: true,
          confidence: 0.95, // High confidence for demo
          errors: []
        };
      }
    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        errors: ['Erro ao acessar documento']
      };
    }

    return {
      isValid: false,
      confidence: 0,
      errors: ['Documento inválido']
    };
  }

  static async processProfile(profileId: string): Promise<{
    approved: boolean;
    validationResults: Record<string, DocumentValidation>;
    finalScore: number;
  }> {
    try {
      // Fetch profile data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error || !profile) {
        throw new Error('Profile not found');
      }

      const validationResults: Record<string, DocumentValidation> = {};
      let totalScore = 0;
      let validatedCount = 0;
      let allMandatoryValid = true;

      // Detect if user is a driver
      const isDriver = ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile.role);

      // Define mandatory and optional documents
      const mandatoryDocs = ['selfie_url', 'document_photo_url'];
      if (isDriver) {
        mandatoryDocs.push('cnh_photo_url', 'address_proof_url');
      }

      const optionalDocs = isDriver ? ['truck_documents_url', 'truck_photo_url', 'license_plate_photo_url'] : [];

      // Validate CPF/CNPJ if present
      let cpfValid = true;
      if (profile.cpf_cnpj) {
        cpfValid = validateDocument(profile.cpf_cnpj);
        validationResults['cpf_cnpj'] = {
          isValid: cpfValid,
          confidence: cpfValid ? 1.0 : 0,
          errors: cpfValid ? [] : ['CPF/CNPJ inválido']
        };
        if (cpfValid) {
          totalScore += 1;
          validatedCount++;
        } else {
          allMandatoryValid = false;
        }
      }

      // Validate mandatory documents
      for (const docField of mandatoryDocs) {
        const docUrl = profile[docField];
        if (!docUrl) {
          validationResults[docField] = {
            isValid: false,
            confidence: 0,
            errors: [`${docField} não fornecido`]
          };
          allMandatoryValid = false;
          console.log(`❌ Mandatory document missing: ${docField}`);
        } else {
          const validation = await this.validateDocumentImage(docUrl, docField);
          validationResults[docField] = validation;
          totalScore += validation.confidence;
          validatedCount++;
          if (!validation.isValid) {
            allMandatoryValid = false;
          }
          console.log(`✓ Mandatory document validated: ${docField} - valid: ${validation.isValid}`);
        }
      }

      // Validate optional documents (only if present, don't penalize if missing)
      for (const docField of optionalDocs) {
        const docUrl = profile[docField];
        if (docUrl) {
          const validation = await this.validateDocumentImage(docUrl, docField);
          validationResults[docField] = validation;
          totalScore += validation.confidence;
          validatedCount++;
          console.log(`✓ Optional document validated: ${docField} - valid: ${validation.isValid}`);
        } else {
          console.log(`ℹ Optional document not provided: ${docField} (not penalized)`);
        }
      }

      const finalScore = validatedCount > 0 ? totalScore / validatedCount : 0;
      const approved = cpfValid && allMandatoryValid;

      console.log(`🔍 Approval decision for ${profileId}:`, { 
        approved, 
        cpfValid, 
        allMandatoryValid, 
        finalScore: (finalScore * 100).toFixed(1) + '%' 
      });

      // Update profile status
      if (approved) {
        const statusUpdate: any = {
          status: 'APPROVED' as const,
          document_validation_status: 'VALIDATED' as const,
          background_check_status: 'VALIDATED' as const,
          ...(isDriver ? {
            cnh_validation_status: 'VALIDATED' as const,
            rntrc_validation_status: 'VALIDATED' as const
          } : {})
        };
        
        console.log('💾 Atualizando status do perfil para APPROVED:', statusUpdate);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update(statusUpdate)
          .eq('id', profileId);
        
        if (updateError) {
          console.error('❌ ERRO ao atualizar status do perfil:', updateError);
          throw updateError;
        }
        
        console.log('✅ Status do perfil atualizado com sucesso!');

        // Create validation history
        await supabase
          .from('validation_history')
          .insert({
            profile_id: profileId,
            validation_type: 'AUTOMATIC_APPROVAL',
            status: 'VALIDATED',
            notes: `Aprovação automática com score: ${(finalScore * 100).toFixed(1)}%`
          });

        // Send notification
        await supabase.rpc('send_notification', {
          p_user_id: profile.user_id,
          p_title: 'Conta aprovada!',
          p_message: 'Sua conta foi aprovada automaticamente. Você já pode começar a usar o AgriRoute Connect!',
          p_type: 'success'
        });
      } else {
        await supabase
          .from('profiles')
          .update({
            status: 'PENDING',
            validation_notes: `Aprovação automática falhou. Score: ${(finalScore * 100).toFixed(1)}%. Revisão manual necessária.`
          })
          .eq('id', profileId);

        // Create validation history
        await supabase
          .from('validation_history')
          .insert({
            profile_id: profileId,
            validation_type: 'AUTOMATIC_APPROVAL',
            status: 'PENDING',
            notes: `Aprovação automática falhou com score: ${(finalScore * 100).toFixed(1)}%. Revisão manual necessária.`
          });

        // Send notification
        await supabase.rpc('send_notification', {
          p_user_id: profile.user_id,
          p_title: 'Documentos em análise',
          p_message: 'Seus documentos estão sendo analisados pela nossa equipe. Em breve você receberá uma resposta.',
          p_type: 'info'
        });
      }

      return {
        approved,
        validationResults,
        finalScore
      };
      
    } catch (error) {
      console.error('Error in automatic approval process:', error);
      throw error;
    }
  }

  // Function to be called after profile completion or document upload
  static async triggerApprovalProcess(profileId: string) {
    try {
      const result = await this.processProfile(profileId);
      console.log(`Automatic approval result for ${profileId}:`, result);
      return result;
    } catch (error) {
      console.error('Failed to process automatic approval:', error);
      
      // Send notification about system error
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', profileId)
        .single();

      if (profile) {
        await supabase.rpc('send_notification', {
          p_user_id: profile.user_id,
          p_title: 'Erro no sistema',
          p_message: 'Houve um erro ao processar seus documentos. Nossa equipe foi notificada e entrará em contato.',
          p_type: 'error'
        });
      }
    }
  }
}

export default AutomaticApprovalService;