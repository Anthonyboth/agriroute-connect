export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      antt_freight_prices: {
        Row: {
          base_price: number
          created_at: string
          distance_range_max: number | null
          distance_range_min: number
          id: string
          price_per_km: number
          service_type: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          distance_range_max?: number | null
          distance_range_min: number
          id?: string
          price_per_km: number
          service_type: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          distance_range_max?: number | null
          distance_range_min?: number
          id?: string
          price_per_km?: number
          service_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      freight_proposals: {
        Row: {
          created_at: string
          delivery_estimate_days: number | null
          driver_id: string
          freight_id: string
          id: string
          justification: string | null
          message: string | null
          proposed_price: number
          status: string
        }
        Insert: {
          created_at?: string
          delivery_estimate_days?: number | null
          driver_id: string
          freight_id: string
          id?: string
          justification?: string | null
          message?: string | null
          proposed_price: number
          status?: string
        }
        Update: {
          created_at?: string
          delivery_estimate_days?: number | null
          driver_id?: string
          freight_id?: string
          id?: string
          justification?: string | null
          message?: string | null
          proposed_price?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_proposals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_proposals_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freights: {
        Row: {
          cargo_type: string
          created_at: string
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          fiscal_documents_url: string | null
          id: string
          minimum_antt_price: number | null
          origin_address: string
          origin_lat: number | null
          origin_lng: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          producer_id: string
          service_type: string | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          vehicle_type_required:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          weight: number
        }
        Insert: {
          cargo_type: string
          created_at?: string
          delivery_date: string
          delivery_observations?: string | null
          description?: string | null
          destination_address: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          fiscal_documents_url?: string | null
          id?: string
          minimum_antt_price?: number | null
          origin_address: string
          origin_lat?: number | null
          origin_lng?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations?: string | null
          price: number
          producer_id: string
          service_type?: string | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          vehicle_type_required?:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          weight: number
        }
        Update: {
          cargo_type?: string
          created_at?: string
          delivery_date?: string
          delivery_observations?: string | null
          description?: string | null
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          fiscal_documents_url?: string | null
          id?: string
          minimum_antt_price?: number | null
          origin_address?: string
          origin_lat?: number | null
          origin_lng?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date?: string
          pickup_observations?: string | null
          price?: number
          producer_id?: string
          service_type?: string | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          vehicle_type_required?:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "freights_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freights_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_proof_url: string | null
          antt_number: string | null
          cnh_photo_url: string | null
          contact_phone: string | null
          cooperative: string | null
          cpf_cnpj: string | null
          created_at: string
          document: string | null
          document_photo_url: string | null
          farm_address: string | null
          farm_lat: number | null
          farm_lng: number | null
          farm_name: string | null
          full_name: string
          id: string
          license_plate_photo_url: string | null
          location_enabled: boolean | null
          phone: string | null
          rating: number | null
          rating_sum: number | null
          rntrc: string | null
          role: Database["public"]["Enums"]["user_role"]
          selfie_url: string | null
          status: Database["public"]["Enums"]["user_status"]
          total_ratings: number | null
          truck_documents_url: string | null
          truck_photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_proof_url?: string | null
          antt_number?: string | null
          cnh_photo_url?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          document?: string | null
          document_photo_url?: string | null
          farm_address?: string | null
          farm_lat?: number | null
          farm_lng?: number | null
          farm_name?: string | null
          full_name: string
          id?: string
          license_plate_photo_url?: string | null
          location_enabled?: boolean | null
          phone?: string | null
          rating?: number | null
          rating_sum?: number | null
          rntrc?: string | null
          role: Database["public"]["Enums"]["user_role"]
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          total_ratings?: number | null
          truck_documents_url?: string | null
          truck_photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_proof_url?: string | null
          antt_number?: string | null
          cnh_photo_url?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          document?: string | null
          document_photo_url?: string | null
          farm_address?: string | null
          farm_lat?: number | null
          farm_lng?: number | null
          farm_name?: string | null
          full_name?: string
          id?: string
          license_plate_photo_url?: string | null
          location_enabled?: boolean | null
          phone?: string | null
          rating?: number | null
          rating_sum?: number | null
          rntrc?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          total_ratings?: number | null
          truck_documents_url?: string | null
          truck_photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          freight_id: string | null
          id: string
          rated_user_id: string
          rater_user_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          freight_id?: string | null
          id?: string
          rated_user_id: string
          rater_user_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          freight_id?: string | null
          id?: string
          rated_user_id?: string
          rater_user_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          axle_count: number
          created_at: string
          crlv_url: string | null
          driver_id: string
          id: string
          license_plate: string
          max_capacity_tons: number
          status: string
          updated_at: string
          vehicle_photo_url: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          axle_count?: number
          created_at?: string
          crlv_url?: string | null
          driver_id: string
          id?: string
          license_plate: string
          max_capacity_tons: number
          status?: string
          updated_at?: string
          vehicle_photo_url?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          axle_count?: number
          created_at?: string
          crlv_url?: string | null
          driver_id?: string
          id?: string
          license_plate?: string
          max_capacity_tons?: number
          status?: string
          updated_at?: string
          vehicle_photo_url?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      freight_status:
        | "OPEN"
        | "IN_NEGOTIATION"
        | "ACCEPTED"
        | "IN_TRANSIT"
        | "DELIVERED"
        | "CANCELLED"
        | "GUINCHO"
        | "MUDANCA"
      payment_method: "PIX" | "BOLETO" | "CARTAO" | "DIRETO"
      urgency_level: "LOW" | "MEDIUM" | "HIGH"
      user_role: "PRODUTOR" | "MOTORISTA" | "ADMIN"
      user_status: "PENDING" | "APPROVED" | "REJECTED"
      vehicle_type: "TRUCK" | "BITREM" | "RODOTREM" | "CARRETA" | "VUC" | "TOCO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      freight_status: [
        "OPEN",
        "IN_NEGOTIATION",
        "ACCEPTED",
        "IN_TRANSIT",
        "DELIVERED",
        "CANCELLED",
        "GUINCHO",
        "MUDANCA",
      ],
      payment_method: ["PIX", "BOLETO", "CARTAO", "DIRETO"],
      urgency_level: ["LOW", "MEDIUM", "HIGH"],
      user_role: ["PRODUTOR", "MOTORISTA", "ADMIN"],
      user_status: ["PENDING", "APPROVED", "REJECTED"],
      vehicle_type: ["TRUCK", "BITREM", "RODOTREM", "CARRETA", "VUC", "TOCO"],
    },
  },
} as const
