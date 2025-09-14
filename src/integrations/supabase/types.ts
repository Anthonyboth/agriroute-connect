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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_reports: {
        Row: {
          active_drivers: number | null
          active_producers: number | null
          average_freight_value: number | null
          commission_earned: number | null
          created_at: string
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          report_type: string
          revenue_breakdown: Json | null
          top_routes: Json | null
          total_freights: number | null
          total_revenue: number | null
          total_users: number | null
          user_growth: Json | null
        }
        Insert: {
          active_drivers?: number | null
          active_producers?: number | null
          average_freight_value?: number | null
          commission_earned?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          report_type: string
          revenue_breakdown?: Json | null
          top_routes?: Json | null
          total_freights?: number | null
          total_revenue?: number | null
          total_users?: number | null
          user_growth?: Json | null
        }
        Update: {
          active_drivers?: number | null
          active_producers?: number | null
          average_freight_value?: number | null
          commission_earned?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          report_type?: string
          revenue_breakdown?: Json | null
          top_routes?: Json | null
          total_freights?: number | null
          total_revenue?: number | null
          total_users?: number | null
          user_growth?: Json | null
        }
        Relationships: []
      }
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
      driver_availability: {
        Row: {
          available_date: string
          available_until_date: string | null
          city: string
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          state: string
          updated_at: string
        }
        Insert: {
          available_date: string
          available_until_date?: string | null
          city: string
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          state: string
          updated_at?: string
        }
        Update: {
          available_date?: string
          available_until_date?: string | null
          city?: string
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      emergency_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          freight_id: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type?: string
          freight_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          freight_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_events_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flexible_freight_proposals: {
        Row: {
          created_at: string
          days_difference: number
          driver_id: string
          freight_id: string
          id: string
          message: string | null
          original_date: string
          proposed_date: string
          proposed_price: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_difference: number
          driver_id: string
          freight_id: string
          id?: string
          message?: string | null
          original_date: string
          proposed_date: string
          proposed_price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_difference?: number
          driver_id?: string
          freight_id?: string
          id?: string
          message?: string | null
          original_date?: string
          proposed_date?: string
          proposed_price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      freight_advances: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          created_at: string
          driver_id: string
          freight_id: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string
          producer_id: string
          requested_amount: number
          requested_at: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          created_at?: string
          driver_id: string
          freight_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          producer_id: string
          requested_amount: number
          requested_at?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          created_at?: string
          driver_id?: string
          freight_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          producer_id?: string
          requested_amount?: number
          requested_at?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_advances_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_attachments: {
        Row: {
          created_at: string
          description: string | null
          file_type: string
          file_url: string
          freight_id: string
          id: string
          upload_stage: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type: string
          file_url: string
          freight_id: string
          id?: string
          upload_stage: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string
          file_url?: string
          freight_id?: string
          id?: string
          upload_stage?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_attachments_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_messages: {
        Row: {
          created_at: string
          freight_id: string
          id: string
          image_url: string | null
          message: string
          message_type: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          freight_id: string
          id?: string
          image_url?: string | null
          message: string
          message_type?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          freight_id?: string
          id?: string
          image_url?: string | null
          message?: string
          message_type?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_messages_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_payments: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          external_transaction_id: string | null
          freight_id: string
          id: string
          metadata: Json | null
          payer_id: string
          payment_method: string
          payment_type: string
          receiver_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          external_transaction_id?: string | null
          freight_id: string
          id?: string
          metadata?: Json | null
          payer_id: string
          payment_method: string
          payment_type: string
          receiver_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          external_transaction_id?: string | null
          freight_id?: string
          id?: string
          metadata?: Json | null
          payer_id?: string
          payment_method?: string
          payment_type?: string
          receiver_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_payments_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
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
      freight_status_history: {
        Row: {
          changed_by: string
          created_at: string
          freight_id: string
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          status: Database["public"]["Enums"]["freight_status"]
        }
        Insert: {
          changed_by: string
          created_at?: string
          freight_id: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status: Database["public"]["Enums"]["freight_status"]
        }
        Update: {
          changed_by?: string
          created_at?: string
          freight_id?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["freight_status"]
        }
        Relationships: [
          {
            foreignKeyName: "freight_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_status_history_freight_id_fkey"
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
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          date_range_end: string | null
          date_range_start: string | null
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          fiscal_documents_url: string | null
          flexible_dates: boolean | null
          id: string
          is_scheduled: boolean | null
          last_location_update: string | null
          minimum_antt_price: number | null
          origin_address: string
          origin_lat: number | null
          origin_lng: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          producer_id: string
          scheduled_date: string | null
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
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          delivery_date: string
          delivery_observations?: string | null
          description?: string | null
          destination_address: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          fiscal_documents_url?: string | null
          flexible_dates?: boolean | null
          id?: string
          is_scheduled?: boolean | null
          last_location_update?: string | null
          minimum_antt_price?: number | null
          origin_address: string
          origin_lat?: number | null
          origin_lng?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations?: string | null
          price: number
          producer_id: string
          scheduled_date?: string | null
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
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          delivery_date?: string
          delivery_observations?: string | null
          description?: string | null
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          fiscal_documents_url?: string | null
          flexible_dates?: boolean | null
          id?: string
          is_scheduled?: boolean | null
          last_location_update?: string | null
          minimum_antt_price?: number | null
          origin_address?: string
          origin_lat?: number | null
          origin_lng?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date?: string
          pickup_observations?: string | null
          price?: number
          producer_id?: string
          scheduled_date?: string | null
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
      loyalty_points: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          freight_id: string | null
          id: string
          points: number
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          freight_id?: string | null
          id?: string
          points?: number
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          freight_id?: string | null
          id?: string
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          created_at: string
          id: string
          metric_type: string
          period_end: string
          period_start: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_type: string
          period_end: string
          period_start: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_type?: string
          period_end?: string
          period_start?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_proof_url: string | null
          antt_number: string | null
          aprovado: boolean | null
          background_check_status: string | null
          cnh_category: string | null
          cnh_expiry_date: string | null
          cnh_photo_url: string | null
          cnh_validation_status: string | null
          contact_phone: string | null
          cooperative: string | null
          cpf_cnpj: string | null
          created_at: string
          current_location_lat: number | null
          current_location_lng: number | null
          document: string | null
          document_photo_url: string | null
          document_validation_status: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          farm_address: string | null
          farm_lat: number | null
          farm_lng: number | null
          farm_name: string | null
          full_name: string
          id: string
          last_gps_update: string | null
          license_plate_photo_url: string | null
          location_enabled: boolean | null
          phone: string | null
          rating: number | null
          rating_locked: boolean | null
          rating_sum: number | null
          rntrc: string | null
          rntrc_validation_status: string | null
          role: Database["public"]["Enums"]["user_role"]
          selfie_url: string | null
          service_types: string[] | null
          status: Database["public"]["Enums"]["user_status"]
          total_ratings: number | null
          truck_documents_url: string | null
          truck_photo_url: string | null
          updated_at: string
          user_id: string
          validation_notes: string | null
        }
        Insert: {
          address_proof_url?: string | null
          antt_number?: string | null
          aprovado?: boolean | null
          background_check_status?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_photo_url?: string | null
          cnh_validation_status?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          current_location_lat?: number | null
          current_location_lng?: number | null
          document?: string | null
          document_photo_url?: string | null
          document_validation_status?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          farm_address?: string | null
          farm_lat?: number | null
          farm_lng?: number | null
          farm_name?: string | null
          full_name: string
          id?: string
          last_gps_update?: string | null
          license_plate_photo_url?: string | null
          location_enabled?: boolean | null
          phone?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: string | null
          rntrc_validation_status?: string | null
          role: Database["public"]["Enums"]["user_role"]
          selfie_url?: string | null
          service_types?: string[] | null
          status?: Database["public"]["Enums"]["user_status"]
          total_ratings?: number | null
          truck_documents_url?: string | null
          truck_photo_url?: string | null
          updated_at?: string
          user_id: string
          validation_notes?: string | null
        }
        Update: {
          address_proof_url?: string | null
          antt_number?: string | null
          aprovado?: boolean | null
          background_check_status?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_photo_url?: string | null
          cnh_validation_status?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          current_location_lat?: number | null
          current_location_lng?: number | null
          document?: string | null
          document_photo_url?: string | null
          document_validation_status?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          farm_address?: string | null
          farm_lat?: number | null
          farm_lng?: number | null
          farm_name?: string | null
          full_name?: string
          id?: string
          last_gps_update?: string | null
          license_plate_photo_url?: string | null
          location_enabled?: boolean | null
          phone?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: string | null
          rntrc_validation_status?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selfie_url?: string | null
          service_types?: string[] | null
          status?: Database["public"]["Enums"]["user_status"]
          total_ratings?: number | null
          truck_documents_url?: string | null
          truck_photo_url?: string | null
          updated_at?: string
          user_id?: string
          validation_notes?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          min_amount: number | null
          title: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          max_uses?: number | null
          min_amount?: number | null
          title: string
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          min_amount?: number | null
          title?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
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
      referral_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          max_uses: number | null
          referral_bonus: number
          updated_at: string
          user_id: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          max_uses?: number | null
          referral_bonus?: number
          updated_at?: string
          user_id: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          max_uses?: number | null
          referral_bonus?: number
          updated_at?: string
          user_id?: string
          uses?: number
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_loyalty: {
        Row: {
          completed_freights: number
          created_at: string
          id: string
          tier: string
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_freights?: number
          created_at?: string
          id?: string
          tier?: string
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_freights?: number
          created_at?: string
          id?: string
          tier?: string
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_referrals: {
        Row: {
          bonus_awarded: boolean
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          bonus_awarded?: boolean
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          bonus_awarded?: boolean
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      validation_history: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          status: string
          updated_at: string
          validated_by: string | null
          validation_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          status: string
          updated_at?: string
          validated_by?: string | null
          validation_type: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          status?: string
          updated_at?: string
          validated_by?: string | null
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_history_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          axle_count: number
          created_at: string
          crlv_expiry_date: string | null
          crlv_url: string | null
          driver_id: string
          id: string
          inspection_certificate_url: string | null
          insurance_document_url: string | null
          insurance_expiry_date: string | null
          last_inspection_date: string | null
          license_plate: string
          max_capacity_tons: number
          status: string
          updated_at: string
          vehicle_photo_url: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vehicle_validation_status: string | null
        }
        Insert: {
          axle_count?: number
          created_at?: string
          crlv_expiry_date?: string | null
          crlv_url?: string | null
          driver_id: string
          id?: string
          inspection_certificate_url?: string | null
          insurance_document_url?: string | null
          insurance_expiry_date?: string | null
          last_inspection_date?: string | null
          license_plate: string
          max_capacity_tons: number
          status?: string
          updated_at?: string
          vehicle_photo_url?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vehicle_validation_status?: string | null
        }
        Update: {
          axle_count?: number
          created_at?: string
          crlv_expiry_date?: string | null
          crlv_url?: string | null
          driver_id?: string
          id?: string
          inspection_certificate_url?: string | null
          insurance_document_url?: string | null
          insurance_expiry_date?: string | null
          last_inspection_date?: string | null
          license_plate?: string
          max_capacity_tons?: number
          status?: string
          updated_at?: string
          vehicle_photo_url?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          vehicle_validation_status?: string | null
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
      check_expired_documents: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_low_ratings: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_admin_report: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_report_type: string
        }
        Returns: string
      }
      get_compatible_freights_for_driver: {
        Args: { p_driver_id: string }
        Returns: {
          cargo_type: string
          created_at: string
          delivery_date: string
          destination_address: string
          distance_km: number
          freight_id: string
          minimum_antt_price: number
          origin_address: string
          pickup_date: string
          price: number
          service_type: string
          status: string
          urgency: string
          weight: number
        }[]
      }
      get_scheduled_freights_by_location_and_date: {
        Args: { p_city: string; p_date: string; p_days_range?: number }
        Returns: {
          cargo_type: string
          date_range_end: string
          date_range_start: string
          destination_address: string
          distance_km: number
          flexible_dates: boolean
          freight_id: string
          origin_address: string
          price: number
          producer_name: string
          scheduled_date: string
          weight: number
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_service_compatible: {
        Args: { driver_service_types: string[]; freight_service_type: string }
        Returns: boolean
      }
      send_notification: {
        Args: {
          p_data?: Json
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
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
        | "LOADING"
        | "LOADED"
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
        "LOADING",
        "LOADED",
      ],
      payment_method: ["PIX", "BOLETO", "CARTAO", "DIRETO"],
      urgency_level: ["LOW", "MEDIUM", "HIGH"],
      user_role: ["PRODUTOR", "MOTORISTA", "ADMIN"],
      user_status: ["PENDING", "APPROVED", "REJECTED"],
      vehicle_type: ["TRUCK", "BITREM", "RODOTREM", "CARRETA", "VUC", "TOCO"],
    },
  },
} as const
