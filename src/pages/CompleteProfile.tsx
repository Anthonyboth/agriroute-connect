import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DocumentUpload from '@/components/DocumentUpload';
import LocationPermission from '@/components/LocationPermission';
import { CheckCircle, AlertCircle, User, FileText, Truck } from 'lucide-react';

const CompleteProfile = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [documentUrls, setDocumentUrls] = useState({
    selfie: '',
    document_photo: '',
    cnh: '',
    truck_documents: '',
    truck_photo: '',
    license_plate: '',
    address_proof: ''
  });
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/auth');
      return;
    }

    if (profile) {
      // Load existing document URLs
      setDocumentUrls({
        selfie: profile.selfie_url || '',
        document_photo: profile.document_photo_url || '',
        cnh: profile.cnh_photo_url || '',
        truck_documents: profile.truck_documents_url || '',
        truck_photo: profile.truck_photo_url || '',
        license_plate: profile.license_plate_photo_url || '',
        address_proof: profile.address_proof_url || ''
      });
      setLocationEnabled(profile.location_enabled || false);

      // Check if profile is already complete
      const isProfileComplete = profile.selfie_url && profile.document_photo_url;
      const isDriverComplete = profile.role !== 'MOTORISTA' || (
        profile.cnh_photo_url && 
        profile.truck_documents_url && 
        profile.truck_photo_url && 
        profile.license_plate_photo_url && 
        profile.address_proof_url &&
        profile.location_enabled
      );

      if (isProfileComplete && isDriverComplete) {
        // Redirect to appropriate dashboard
        const dashboardPath = profile.role === 'MOTORISTA' ? '/dashboard/driver' : '/dashboard/producer';
        navigate(dashboardPath);
      }
    }
  }, [profile, authLoading, navigate]);

  const handleSaveAndContinue = async () => {
    if (!profile) return;

    // Validate step 1 requirements
    if (currentStep === 1) {
      if (!documentUrls.selfie || !documentUrls.document_photo) {
        toast.error('Por favor, envie sua selfie e foto do documento');
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Validate step 2 requirements for drivers
    if (currentStep === 2 && profile.role === 'MOTORISTA') {
      const requiredDocs = ['cnh', 'truck_documents', 'truck_photo', 'license_plate', 'address_proof'];
      const missingDocs = requiredDocs.filter(doc => !documentUrls[doc as keyof typeof documentUrls]);
      
      if (missingDocs.length > 0) {
        toast.error('Por favor, envie todos os documentos obrigatórios');
        return;
      }

      if (!locationEnabled) {
        toast.error('Ative a localização para continuar');
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          selfie_url: documentUrls.selfie,
          document_photo_url: documentUrls.document_photo,
          cnh_photo_url: documentUrls.cnh,
          truck_documents_url: documentUrls.truck_documents,
          truck_photo_url: documentUrls.truck_photo,
          license_plate_photo_url: documentUrls.license_plate,
          address_proof_url: documentUrls.address_proof,
          location_enabled: locationEnabled
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      toast.success('Perfil completado com sucesso! Aguarde aprovação.');
      
      // Redirect to appropriate dashboard
      const dashboardPath = profile.role === 'MOTORISTA' ? '/dashboard/driver' : '/dashboard/producer';
      navigate(dashboardPath);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const totalSteps = profile.role === 'MOTORISTA' ? 2 : 1;
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Complete seu Perfil</CardTitle>
            <CardDescription>
              {profile.role === 'MOTORISTA' 
                ? 'Envie seus documentos e ative a localização para começar a usar o app'
                : 'Envie seus documentos para completar o cadastro'
              }
            </CardDescription>
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Etapa {currentStep} de {totalSteps}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Basic Documents */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Documentos Básicos</h3>
                </div>

                <DocumentUpload
                  label="Selfie"
                  fileType="selfie"
                  bucketName="profile-photos"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, selfie: url }))}
                  required
                />

                <DocumentUpload
                  label="Foto do Documento (RG/CNH)"
                  fileType="document"
                  bucketName="profile-photos"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, document_photo: url }))}
                  required
                />

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveAndContinue}
                    disabled={!documentUrls.selfie || !documentUrls.document_photo}
                  >
                    {profile.role === 'MOTORISTA' ? 'Continuar' : 'Finalizar Cadastro'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Driver Documents */}
            {currentStep === 2 && profile.role === 'MOTORISTA' && (
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Documentos do Motorista</h3>
                </div>

                <DocumentUpload
                  label="CNH (Carteira Nacional de Habilitação)"
                  fileType="cnh"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, cnh: url }))}
                  required
                />

                <DocumentUpload
                  label="Documentos da Carreta"
                  fileType="truck_docs"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, truck_documents: url }))}
                  required
                />

                <DocumentUpload
                  label="Foto da Carreta"
                  fileType="truck_photo"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, truck_photo: url }))}
                  required
                />

                <DocumentUpload
                  label="Foto das Placas"
                  fileType="plates"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, license_plate: url }))}
                  required
                />

                <DocumentUpload
                  label="Comprovante de Endereço"
                  fileType="address"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, address_proof: url }))}
                  required
                  accept="image/*,application/pdf"
                />

                <LocationPermission
                  onPermissionChange={setLocationEnabled}
                  required
                />

                <div className="flex justify-between">
                  <Button 
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                  >
                    Voltar
                  </Button>
                  <Button 
                    onClick={handleSaveAndContinue}
                    disabled={loading}
                  >
                    {loading ? 'Salvando...' : 'Finalizar Cadastro'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;