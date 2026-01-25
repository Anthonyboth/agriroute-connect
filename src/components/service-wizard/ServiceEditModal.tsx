import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { URGENCY_LABELS } from "./types";

interface ServiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  serviceRequest: {
    id: string;
    service_type: string;
    problem_description?: string;
    urgency?: string;
    location_address?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    additional_info?: any;
    status?: string;
    city_name?: string;
    state?: string;
  };
}

export const ServiceEditModal: React.FC<ServiceEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  serviceRequest,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    problem_description: "",
    urgency: "MEDIUM",
    location_address: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    additional_info: "",
  });

  // Prefill form with existing data
  useEffect(() => {
    if (serviceRequest && isOpen) {
      setFormData({
        problem_description: serviceRequest.problem_description || "",
        urgency: serviceRequest.urgency || "MEDIUM",
        location_address: serviceRequest.location_address || "",
        contact_name: serviceRequest.contact_name || "",
        contact_phone: serviceRequest.contact_phone || "",
        contact_email: serviceRequest.contact_email || "",
        additional_info: typeof serviceRequest.additional_info === "string" 
          ? serviceRequest.additional_info 
          : JSON.stringify(serviceRequest.additional_info || {}, null, 2),
      });
    }
  }, [serviceRequest, isOpen]);

  const handleUpdate = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const serviceTypeLabels: Record<string, string> = useMemo(() => ({
    GUINCHO: "Guincho",
    FRETE_MOTO: "Frete Moto",
    FRETE_URBANO: "Frete Urbano",
    MUDANCA_RESIDENCIAL: "Mudança Residencial",
    MUDANCA_COMERCIAL: "Mudança Comercial",
    SERVICO_AGRICOLA: "Serviço Agrícola",
    SERVICO_TECNICO: "Serviço Técnico",
  }), []);

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);

    // Log before update for debugging
    console.log('[P0_EDIT_SERVICE] BEFORE_UPDATE', {
      service_request_id: serviceRequest.id,
      service_type: serviceRequest.service_type,
      formData,
      timestamp: new Date().toISOString()
    });

    try {
      // Parse additional_info if it looks like JSON
      let additionalInfo = formData.additional_info;
      if (additionalInfo.trim().startsWith("{") || additionalInfo.trim().startsWith("[")) {
        try {
          additionalInfo = JSON.parse(additionalInfo);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      // Use type assertion since the RPC was just created and types need regeneration
      const { data, error } = await (supabase.rpc as any)('update_producer_service_request', {
        p_request_id: serviceRequest.id,
        p_problem_description: formData.problem_description || null,
        p_urgency: formData.urgency || null,
        p_location_address: formData.location_address || null,
        p_contact_name: formData.contact_name || null,
        p_contact_phone: formData.contact_phone || null,
        p_contact_email: formData.contact_email || null,
        p_additional_info: typeof additionalInfo === "string" ? additionalInfo : JSON.stringify(additionalInfo)
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; debug_info?: any };

      console.log('[P0_EDIT_SERVICE] RPC_RESULT', {
        service_request_id: serviceRequest.id,
        success: result.success,
        error: result.error,
        debug_info: result.debug_info,
        timestamp: new Date().toISOString()
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar serviço');
      }

      toast.success('Serviço atualizado com sucesso!');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[P0_EDIT_SERVICE] ERROR', {
        service_request_id: serviceRequest.id,
        error_message: error?.message,
        timestamp: new Date().toISOString()
      });
      toast.error(error.message || 'Erro ao atualizar serviço');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Editar {serviceTypeLabels[serviceRequest.service_type] || serviceRequest.service_type}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Problem Description */}
          <div className="space-y-2">
            <Label htmlFor="problem_description">Descrição do Serviço</Label>
            <Textarea
              id="problem_description"
              value={formData.problem_description}
              onChange={(e) => handleUpdate("problem_description", e.target.value)}
              placeholder="Descreva o serviço solicitado..."
              rows={3}
            />
          </div>

          {/* Urgency */}
          <div className="space-y-2">
            <Label htmlFor="urgency">Urgência</Label>
            <Select
              value={formData.urgency}
              onValueChange={(value) => handleUpdate("urgency", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a urgência" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(URGENCY_LABELS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label} - {info.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location_address">Endereço</Label>
            <Textarea
              id="location_address"
              value={formData.location_address}
              onChange={(e) => handleUpdate("location_address", e.target.value)}
              placeholder="Endereço do serviço..."
              rows={2}
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome de Contato</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => handleUpdate("contact_name", e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefone</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => handleUpdate("contact_phone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">E-mail (opcional)</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => handleUpdate("contact_email", e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
