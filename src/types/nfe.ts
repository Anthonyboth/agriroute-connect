export interface NFeDocument {
  id: string;
  access_key: string;
  issuer_cnpj: string;
  issuer_name: string;
  number: string;
  series: string;
  issue_date: string;
  value: number;
  status: 'pending' | 'manifested' | 'rejected' | 'cancelled';
  manifestation_type?: ManifestationType;
  manifestation_date?: string;
  manifestation_justification?: string;
  freight_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ManifestationType = 
  | 'operation_confirmed'
  | 'operation_unknown' 
  | 'rejection'
  | 'cancellation';

export interface NFeManifestationPayload {
  access_key: string;
  manifestation_type: ManifestationType;
  justification?: string;
  freight_id?: string;
}

export interface NFeFilter {
  status?: string;
  freight_id?: string;
}
