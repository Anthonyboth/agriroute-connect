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
      access_denied_logs: {
        Row: {
          attempted_route: string
          created_at: string | null
          id: string
          ip_address: unknown
          profile_id: string | null
          required_roles: string[]
          user_agent: string | null
          user_id: string | null
          user_roles: string[]
        }
        Insert: {
          attempted_route: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          profile_id?: string | null
          required_roles: string[]
          user_agent?: string | null
          user_id?: string | null
          user_roles: string[]
        }
        Update: {
          attempted_route?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          profile_id?: string | null
          required_roles?: string[]
          user_agent?: string | null
          user_id?: string | null
          user_roles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "access_denied_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_password_reset_limits: {
        Row: {
          admin_profile_id: string
          created_at: string
          id: string
          max_resets_per_hour: number
          reset_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          admin_profile_id: string
          created_at?: string
          id?: string
          max_resets_per_hour?: number
          reset_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          admin_profile_id?: string
          created_at?: string
          id?: string
          max_resets_per_hour?: number
          reset_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_password_reset_limits_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      affiliated_drivers_tracking: {
        Row: {
          can_accept_autonomous_freights: boolean | null
          company_id: string | null
          created_at: string | null
          current_freight_id: string | null
          current_lat: number | null
          current_lng: number | null
          driver_profile_id: string | null
          id: string
          is_available: boolean | null
          last_gps_update: string | null
          tracking_status: string | null
          updated_at: string | null
        }
        Insert: {
          can_accept_autonomous_freights?: boolean | null
          company_id?: string | null
          created_at?: string | null
          current_freight_id?: string | null
          current_lat?: number | null
          current_lng?: number | null
          driver_profile_id?: string | null
          id?: string
          is_available?: boolean | null
          last_gps_update?: string | null
          tracking_status?: string | null
          updated_at?: string | null
        }
        Update: {
          can_accept_autonomous_freights?: boolean | null
          company_id?: string | null
          created_at?: string | null
          current_freight_id?: string | null
          current_lat?: number | null
          current_lng?: number | null
          driver_profile_id?: string | null
          id?: string
          is_available?: boolean | null
          last_gps_update?: string | null
          tracking_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliated_drivers_tracking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliated_drivers_tracking_current_freight_id_fkey"
            columns: ["current_freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliated_drivers_tracking_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      antt_rates: {
        Row: {
          axles: number
          cargo_category: string
          created_at: string | null
          diesel_price: number | null
          effective_date: string | null
          fixed_charge: number
          id: string
          rate_per_km: number
          table_type: string
          updated_at: string | null
        }
        Insert: {
          axles: number
          cargo_category: string
          created_at?: string | null
          diesel_price?: number | null
          effective_date?: string | null
          fixed_charge: number
          id?: string
          rate_per_km: number
          table_type: string
          updated_at?: string | null
        }
        Update: {
          axles?: number
          cargo_category?: string
          created_at?: string | null
          diesel_price?: number | null
          effective_date?: string | null
          fixed_charge?: number
          id?: string
          rate_per_km?: number
          table_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      antt_recalculation_history: {
        Row: {
          created_at: string | null
          details: Json | null
          error_messages: Json | null
          executed_at: string | null
          executed_by: string | null
          execution_time_ms: number | null
          freights_failed: number
          freights_processed: number
          freights_skipped: number
          freights_updated: number
          id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_messages?: Json | null
          executed_at?: string | null
          executed_by?: string | null
          execution_time_ms?: number | null
          freights_failed?: number
          freights_processed?: number
          freights_skipped?: number
          freights_updated?: number
          id?: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_messages?: Json | null
          executed_at?: string | null
          executed_by?: string | null
          execution_time_ms?: number | null
          freights_failed?: number
          freights_processed?: number
          freights_skipped?: number
          freights_updated?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "antt_recalculation_history_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string | null
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          operation: string
          session_id: string | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          session_id?: string | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          session_id?: string | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auto_confirm_logs: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          freight_id: string | null
          hours_elapsed: number | null
          id: string
          metadata: Json | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          freight_id?: string | null
          hours_elapsed?: number | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          freight_id?: string | null
          hours_elapsed?: number | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_confirm_logs_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          provider_id: string
          reference_id: string | null
          reference_type: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_payout_id: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          provider_id: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          provider_id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_typing_indicators: {
        Row: {
          company_id: string
          driver_profile_id: string
          id: string
          is_typing: boolean | null
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          company_id: string
          driver_profile_id: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          company_id?: string
          driver_profile_id?: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_typing_indicators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_typing_indicators_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_typing_indicators_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string | null
          ibge_code: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          state: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ibge_code?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          state: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ibge_code?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      company_driver_chats: {
        Row: {
          chat_closed_by: Json | null
          company_id: string
          created_at: string | null
          deleted_at: string | null
          delivered_at: string | null
          driver_profile_id: string
          edited_at: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          message: string
          reactions: Json | null
          read_at: string | null
          reply_to_message_id: string | null
          sender_type: string
        }
        Insert: {
          chat_closed_by?: Json | null
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          driver_profile_id: string
          edited_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message: string
          reactions?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_type: string
        }
        Update: {
          chat_closed_by?: Json | null
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          driver_profile_id?: string
          edited_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message?: string
          reactions?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_driver_chats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_driver_chats_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_driver_chats_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "company_driver_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      company_drivers: {
        Row: {
          accepted_at: string | null
          affiliation_type: string | null
          can_accept_freights: boolean | null
          can_manage_vehicles: boolean | null
          chat_enabled_at: string | null
          company_id: string
          created_at: string | null
          driver_profile_id: string
          id: string
          invited_at: string | null
          invited_by: string | null
          left_at: string | null
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          affiliation_type?: string | null
          can_accept_freights?: boolean | null
          can_manage_vehicles?: boolean | null
          chat_enabled_at?: string | null
          company_id: string
          created_at?: string | null
          driver_profile_id: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          left_at?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          affiliation_type?: string | null
          can_accept_freights?: boolean | null
          can_manage_vehicles?: boolean | null
          chat_enabled_at?: string | null
          company_id?: string
          created_at?: string | null
          driver_profile_id?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          left_at?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_drivers_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_drivers_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_internal_messages: {
        Row: {
          chat_closed_by: Json | null
          company_id: string
          created_at: string | null
          id: string
          image_url: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          message: string
          message_type: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          chat_closed_by?: Json | null
          company_id: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message: string
          message_type?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          chat_closed_by?: Json | null
          company_id?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message?: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_internal_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          invite_code: string
          invite_type: string
          invited_by: string
          invited_driver_id: string | null
          invited_email: string | null
          registration_data: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          invite_type: string
          invited_by: string
          invited_driver_id?: string | null
          invited_email?: string | null
          registration_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          invite_type?: string
          invited_by?: string
          invited_driver_id?: string | null
          invited_email?: string | null
          registration_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_invited_driver_id_fkey"
            columns: ["invited_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_vehicle_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          company_id: string
          created_at: string | null
          driver_profile_id: string
          id: string
          is_primary: boolean | null
          notes: string | null
          removed_at: string | null
          removed_by: string | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id: string
          created_at?: string | null
          driver_profile_id: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          removed_at?: string | null
          removed_by?: string | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string
          created_at?: string | null
          driver_profile_id?: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          removed_at?: string | null
          removed_by?: string | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_vehicle_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_vehicle_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_vehicle_assignments_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_vehicle_assignments_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_motoristas: {
        Row: {
          criado_em: string
          expira_em: string
          id: string
          token: string
          transportadora_id: string
          usado: boolean
          usado_em: string | null
          usado_por: string | null
        }
        Insert: {
          criado_em?: string
          expira_em: string
          id?: string
          token: string
          transportadora_id: string
          usado?: boolean
          usado_em?: string | null
          usado_por?: string | null
        }
        Update: {
          criado_em?: string
          expira_em?: string
          id?: string
          token?: string
          transportadora_id?: string
          usado?: boolean
          usado_em?: string | null
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_motoristas_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_motoristas_usado_por_fkey"
            columns: ["usado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_request_messages: {
        Row: {
          created_at: string
          document_request_id: string
          id: string
          image_url: string | null
          message: string
          message_type: string
          metadata: Json | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          document_request_id: string
          id?: string
          image_url?: string | null
          message: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          document_request_id?: string
          id?: string
          image_url?: string | null
          message?: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_request_messages_document_request_id_fkey"
            columns: ["document_request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_request_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string | null
          driver_profile_id: string
          id: string
          notes: string | null
          requested_at: string | null
          requested_by: string | null
          requested_fields: Json
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          driver_profile_id: string
          id?: string
          notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          requested_fields?: Json
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          driver_profile_id?: string
          id?: string
          notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          requested_fields?: Json
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_availability: {
        Row: {
          available_date: string
          available_until_date: string | null
          city: string
          city_id: string | null
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
          city_id?: string | null
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
          city_id?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_availability_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
        ]
      }
      driver_checkins: {
        Row: {
          checked_at: string
          created_at: string | null
          driver_profile_id: string
          freight_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          checked_at?: string
          created_at?: string | null
          driver_profile_id: string
          freight_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          checked_at?: string
          created_at?: string | null
          driver_profile_id?: string
          freight_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_checkins_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_checkins_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_notification_limits: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          max_notifications_per_hour: number | null
          notification_count: number | null
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          max_notifications_per_hour?: number | null
          notification_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          max_notifications_per_hour?: number | null
          notification_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      driver_payout_requests: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          id: string
          pix_key: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          id?: string
          pix_key: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          pix_key?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payout_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payout_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payouts: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          freight_id: string
          id: string
          metadata: Json | null
          processed_at: string | null
          status: string
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          freight_id: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          freight_id?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_service_areas: {
        Row: {
          city_name: string
          created_at: string | null
          driver_id: string
          geom: unknown
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          radius_km: number
          radius_m: number | null
          service_area: unknown
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city_name: string
          created_at?: string | null
          driver_id: string
          geom?: unknown
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city_name?: string
          created_at?: string | null
          driver_id?: string
          geom?: unknown
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_driver_service_areas_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_stripe_accounts: {
        Row: {
          account_status: string
          charges_enabled: boolean | null
          created_at: string | null
          driver_id: string
          id: string
          payouts_enabled: boolean | null
          pix_key: string | null
          requirements_due: Json | null
          stripe_account_id: string
          updated_at: string | null
        }
        Insert: {
          account_status?: string
          charges_enabled?: boolean | null
          created_at?: string | null
          driver_id: string
          id?: string
          payouts_enabled?: boolean | null
          pix_key?: string | null
          requirements_due?: Json | null
          stripe_account_id: string
          updated_at?: string | null
        }
        Update: {
          account_status?: string
          charges_enabled?: boolean | null
          created_at?: string | null
          driver_id?: string
          id?: string
          payouts_enabled?: boolean | null
          pix_key?: string | null
          requirements_due?: Json | null
          stripe_account_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_withdrawals: {
        Row: {
          amount: number
          created_at: string | null
          driver_id: string
          id: string
          net_amount: number
          pix_key: string
          platform_fee: number | null
          processed_at: string | null
          status: string
          stripe_account_id: string | null
          stripe_payout_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          driver_id: string
          id?: string
          net_amount: number
          pix_key: string
          platform_fee?: number | null
          processed_at?: string | null
          status?: string
          stripe_account_id?: string | null
          stripe_payout_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          driver_id?: string
          id?: string
          net_amount?: number
          pix_key?: string
          platform_fee?: number | null
          processed_at?: string | null
          status?: string
          stripe_account_id?: string | null
          stripe_payout_id?: string | null
          updated_at?: string | null
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
      error_logs: {
        Row: {
          auto_correction_action: string | null
          auto_correction_attempted: boolean | null
          auto_correction_success: boolean | null
          created_at: string | null
          error_category: string
          error_code: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          function_name: string | null
          id: string
          metadata: Json | null
          module: string | null
          route: string | null
          status: string | null
          telegram_notified: boolean | null
          telegram_sent_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          auto_correction_action?: string | null
          auto_correction_attempted?: boolean | null
          auto_correction_success?: boolean | null
          created_at?: string | null
          error_category: string
          error_code?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          function_name?: string | null
          id?: string
          metadata?: Json | null
          module?: string | null
          route?: string | null
          status?: string | null
          telegram_notified?: boolean | null
          telegram_sent_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          auto_correction_action?: string | null
          auto_correction_attempted?: boolean | null
          auto_correction_success?: boolean | null
          created_at?: string | null
          error_category?: string
          error_code?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          function_name?: string | null
          id?: string
          metadata?: Json | null
          module?: string | null
          route?: string | null
          status?: string | null
          telegram_notified?: boolean | null
          telegram_sent_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      evidence_files: {
        Row: {
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          incident_id: string
          mime_type: string | null
          uploaded_at: string
        }
        Insert: {
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          incident_id: string
          mime_type?: string | null
          uploaded_at?: string
        }
        Update: {
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          incident_id?: string
          mime_type?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      external_payments: {
        Row: {
          accepted_at: string | null
          accepted_by_driver: boolean | null
          amount: number
          confirmation_doc: string | null
          confirmed_at: string | null
          created_at: string | null
          driver_id: string
          freight_id: string
          id: string
          notes: string | null
          producer_id: string
          proposed_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_driver?: boolean | null
          amount: number
          confirmation_doc?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          driver_id: string
          freight_id: string
          id?: string
          notes?: string | null
          producer_id: string
          proposed_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_driver?: boolean | null
          amount?: number
          confirmation_doc?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          driver_id?: string
          freight_id?: string
          id?: string
          notes?: string | null
          producer_id?: string
          proposed_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_audit_logs: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      freight_assignments: {
        Row: {
          accepted_at: string
          agreed_price: number
          antt_details: Json | null
          company_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_date: string | null
          driver_id: string
          freight_id: string
          id: string
          metadata: Json | null
          minimum_antt_price: number | null
          notes: string | null
          pickup_date: string | null
          price_per_km: number | null
          pricing_type: string
          proposal_id: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          accepted_at?: string
          agreed_price: number
          antt_details?: Json | null
          company_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_date?: string | null
          driver_id: string
          freight_id: string
          id?: string
          metadata?: Json | null
          minimum_antt_price?: number | null
          notes?: string | null
          pickup_date?: string | null
          price_per_km?: number | null
          pricing_type: string
          proposal_id?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          accepted_at?: string
          agreed_price?: number
          antt_details?: Json | null
          company_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_date?: string | null
          driver_id?: string
          freight_id?: string
          id?: string
          metadata?: Json | null
          minimum_antt_price?: number | null
          notes?: string | null
          pickup_date?: string | null
          price_per_km?: number | null
          pricing_type?: string
          proposal_id?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_assignments_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_assignments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "freight_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      freight_chat_participants: {
        Row: {
          freight_id: string
          id: string
          is_active: boolean | null
          joined_at: string | null
          left_at: string | null
          participant_id: string
          participant_type: string
        }
        Insert: {
          freight_id: string
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          participant_id: string
          participant_type: string
        }
        Update: {
          freight_id?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          participant_id?: string
          participant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_chat_participants_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_chat_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_checkins: {
        Row: {
          checkin_type: string
          counterpart_confirmed_at: string | null
          counterpart_confirmed_by: string | null
          created_at: string
          freight_id: string
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          metadata: Json | null
          observations: string | null
          photos: string[] | null
          requires_counterpart_confirmation: boolean | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_type: string
          counterpart_confirmed_at?: string | null
          counterpart_confirmed_by?: string | null
          created_at?: string
          freight_id: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          observations?: string | null
          photos?: string[] | null
          requires_counterpart_confirmation?: boolean | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_type?: string
          counterpart_confirmed_at?: string | null
          counterpart_confirmed_by?: string | null
          created_at?: string
          freight_id?: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          observations?: string | null
          photos?: string[] | null
          requires_counterpart_confirmation?: boolean | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_checkins_counterpart_confirmed_by_fkey"
            columns: ["counterpart_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_checkins_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_matches: {
        Row: {
          created_at: string | null
          distance_m: number | null
          driver_area_id: string | null
          driver_id: string
          freight_id: string
          id: string
          match_score: number | null
          match_type: string
          notified_at: string | null
        }
        Insert: {
          created_at?: string | null
          distance_m?: number | null
          driver_area_id?: string | null
          driver_id: string
          freight_id: string
          id?: string
          match_score?: number | null
          match_type: string
          notified_at?: string | null
        }
        Update: {
          created_at?: string | null
          distance_m?: number | null
          driver_area_id?: string | null
          driver_id?: string
          freight_id?: string
          id?: string
          match_score?: number | null
          match_type?: string
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_matches_driver_area_id_fkey"
            columns: ["driver_area_id"]
            isOneToOne: false
            referencedRelation: "driver_service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_matches_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_messages: {
        Row: {
          chat_closed_by: Json | null
          created_at: string
          freight_id: string
          id: string
          image_url: string | null
          is_location_request: boolean | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          message: string
          message_type: string
          read_at: string | null
          request_responded_at: string | null
          sender_id: string
          target_driver_id: string | null
          target_vehicle_id: string | null
        }
        Insert: {
          chat_closed_by?: Json | null
          created_at?: string
          freight_id: string
          id?: string
          image_url?: string | null
          is_location_request?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message: string
          message_type?: string
          read_at?: string | null
          request_responded_at?: string | null
          sender_id: string
          target_driver_id?: string | null
          target_vehicle_id?: string | null
        }
        Update: {
          chat_closed_by?: Json | null
          created_at?: string
          freight_id?: string
          id?: string
          image_url?: string | null
          is_location_request?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message?: string
          message_type?: string
          read_at?: string | null
          request_responded_at?: string | null
          sender_id?: string
          target_driver_id?: string | null
          target_vehicle_id?: string | null
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
          {
            foreignKeyName: "freight_messages_target_driver_id_fkey"
            columns: ["target_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_messages_target_vehicle_id_fkey"
            columns: ["target_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_payment_deadlines: {
        Row: {
          created_at: string | null
          deadline_at: string
          freight_id: string
          id: string
          minimum_amount: number
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deadline_at: string
          freight_id: string
          id?: string
          minimum_amount?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deadline_at?: string
          freight_id?: string
          id?: string
          minimum_amount?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_payment_deadlines_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: true
            referencedRelation: "freights"
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
      freight_ratings: {
        Row: {
          comment: string | null
          created_at: string
          freight_id: string
          id: string
          rated_user_id: string
          rater_id: string
          rating: number
          rating_type: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          freight_id: string
          id?: string
          rated_user_id: string
          rater_id: string
          rating: number
          rating_type: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          freight_id?: string
          id?: string
          rated_user_id?: string
          rater_id?: string
          rating?: number
          rating_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_freight_ratings_freight"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_freight_ratings_rated"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_freight_ratings_rater"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          accepted_by_company: boolean | null
          accepted_trucks: number
          allow_counter_proposals: boolean | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cargo_category_antt: string | null
          cargo_type: string
          commission_amount: number | null
          commission_rate: number | null
          company_id: string | null
          contact_phone: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          date_range_end: string | null
          date_range_start: string | null
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_city: string | null
          destination_city_id: string | null
          destination_geog: unknown
          destination_lat: number | null
          destination_lng: number | null
          destination_state: string | null
          distance_km: number | null
          driver_id: string | null
          drivers_assigned: string[] | null
          extra_fees: number | null
          extra_fees_description: string | null
          fiscal_documents_url: string | null
          flexible_dates: boolean | null
          guest_contact_document: string | null
          guest_contact_email: string | null
          guest_contact_name: string | null
          guest_contact_phone: string | null
          high_performance: boolean | null
          id: string
          is_full_booking: boolean | null
          is_guest_freight: boolean | null
          is_scheduled: boolean | null
          last_location_update: string | null
          metadata: Json | null
          minimum_antt_price: number | null
          origin_address: string
          origin_city: string | null
          origin_city_id: string | null
          origin_geog: unknown
          origin_lat: number | null
          origin_lng: number | null
          origin_state: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          price_per_km: number | null
          problem_description: string | null
          producer_id: string
          prospect_user_id: string | null
          required_trucks: number
          route_geom: unknown
          route_waypoints: Json | null
          scheduled_date: string | null
          service_radius_km: number | null
          service_type: string | null
          show_contact_after_accept: boolean | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          tracking_ended_at: string | null
          tracking_required: boolean | null
          tracking_started_at: string | null
          tracking_status: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          vehicle_axles_required: number | null
          vehicle_type_required:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          visibility_filter: string | null
          weight: number
        }
        Insert: {
          accepted_by_company?: boolean | null
          accepted_trucks?: number
          allow_counter_proposals?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cargo_category_antt?: string | null
          cargo_type: string
          commission_amount?: number | null
          commission_rate?: number | null
          company_id?: string | null
          contact_phone?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          delivery_date: string
          delivery_observations?: string | null
          description?: string | null
          destination_address: string
          destination_city?: string | null
          destination_city_id?: string | null
          destination_geog?: unknown
          destination_lat?: number | null
          destination_lng?: number | null
          destination_state?: string | null
          distance_km?: number | null
          driver_id?: string | null
          drivers_assigned?: string[] | null
          extra_fees?: number | null
          extra_fees_description?: string | null
          fiscal_documents_url?: string | null
          flexible_dates?: boolean | null
          guest_contact_document?: string | null
          guest_contact_email?: string | null
          guest_contact_name?: string | null
          guest_contact_phone?: string | null
          high_performance?: boolean | null
          id?: string
          is_full_booking?: boolean | null
          is_guest_freight?: boolean | null
          is_scheduled?: boolean | null
          last_location_update?: string | null
          metadata?: Json | null
          minimum_antt_price?: number | null
          origin_address: string
          origin_city?: string | null
          origin_city_id?: string | null
          origin_geog?: unknown
          origin_lat?: number | null
          origin_lng?: number | null
          origin_state?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations?: string | null
          price: number
          price_per_km?: number | null
          problem_description?: string | null
          producer_id: string
          prospect_user_id?: string | null
          required_trucks?: number
          route_geom?: unknown
          route_waypoints?: Json | null
          scheduled_date?: string | null
          service_radius_km?: number | null
          service_type?: string | null
          show_contact_after_accept?: boolean | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          tracking_ended_at?: string | null
          tracking_required?: boolean | null
          tracking_started_at?: string | null
          tracking_status?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          vehicle_axles_required?: number | null
          vehicle_type_required?:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          visibility_filter?: string | null
          weight: number
        }
        Update: {
          accepted_by_company?: boolean | null
          accepted_trucks?: number
          allow_counter_proposals?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cargo_category_antt?: string | null
          cargo_type?: string
          commission_amount?: number | null
          commission_rate?: number | null
          company_id?: string | null
          contact_phone?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          delivery_date?: string
          delivery_observations?: string | null
          description?: string | null
          destination_address?: string
          destination_city?: string | null
          destination_city_id?: string | null
          destination_geog?: unknown
          destination_lat?: number | null
          destination_lng?: number | null
          destination_state?: string | null
          distance_km?: number | null
          driver_id?: string | null
          drivers_assigned?: string[] | null
          extra_fees?: number | null
          extra_fees_description?: string | null
          fiscal_documents_url?: string | null
          flexible_dates?: boolean | null
          guest_contact_document?: string | null
          guest_contact_email?: string | null
          guest_contact_name?: string | null
          guest_contact_phone?: string | null
          high_performance?: boolean | null
          id?: string
          is_full_booking?: boolean | null
          is_guest_freight?: boolean | null
          is_scheduled?: boolean | null
          last_location_update?: string | null
          metadata?: Json | null
          minimum_antt_price?: number | null
          origin_address?: string
          origin_city?: string | null
          origin_city_id?: string | null
          origin_geog?: unknown
          origin_lat?: number | null
          origin_lng?: number | null
          origin_state?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date?: string
          pickup_observations?: string | null
          price?: number
          price_per_km?: number | null
          problem_description?: string | null
          producer_id?: string
          prospect_user_id?: string | null
          required_trucks?: number
          route_geom?: unknown
          route_waypoints?: Json | null
          scheduled_date?: string | null
          service_radius_km?: number | null
          service_type?: string | null
          show_contact_after_accept?: boolean | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          tracking_ended_at?: string | null
          tracking_required?: boolean | null
          tracking_started_at?: string | null
          tracking_status?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          vehicle_axles_required?: number | null
          vehicle_type_required?:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          visibility_filter?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "freights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freights_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freights_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "freights_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freights_origin_city_id_fkey"
            columns: ["origin_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freights_origin_city_id_fkey"
            columns: ["origin_city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "freights_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freights_prospect_user_id_fkey"
            columns: ["prospect_user_id"]
            isOneToOne: false
            referencedRelation: "prospect_users"
            referencedColumns: ["id"]
          },
        ]
      }
      freights_weight_backup: {
        Row: {
          corrected_at: string | null
          correction_type: string | null
          id: string | null
          new_weight: number | null
          old_weight: number | null
        }
        Insert: {
          corrected_at?: string | null
          correction_type?: string | null
          id?: string | null
          new_weight?: number | null
          old_weight?: number | null
        }
        Update: {
          corrected_at?: string | null
          correction_type?: string | null
          id?: string | null
          new_weight?: number | null
          old_weight?: number | null
        }
        Relationships: []
      }
      guest_requests: {
        Row: {
          city_name: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          payload: Json
          provider_id: string | null
          request_type: string
          service_type: string | null
          state: string | null
          status: string
        }
        Insert: {
          city_name?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          payload: Json
          provider_id?: string | null
          request_type: string
          service_type?: string | null
          state?: string | null
          status?: string
        }
        Update: {
          city_name?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          payload?: Json
          provider_id?: string | null
          request_type?: string
          service_type?: string | null
          state?: string | null
          status?: string
        }
        Relationships: []
      }
      identity_selfies: {
        Row: {
          created_at: string
          id: string
          selfie_url: string
          updated_at: string
          upload_method: string
          user_id: string
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          selfie_url: string
          updated_at?: string
          upload_method?: string
          user_id: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          selfie_url?: string
          updated_at?: string
          upload_method?: string
          user_id?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      incident_logs: {
        Row: {
          auto_generated: boolean | null
          created_at: string
          description: string | null
          evidence_data: Json | null
          freight_id: string
          id: string
          incident_type: string
          last_known_lat: number | null
          last_known_lng: number | null
          operator_id: string | null
          reported_to_authorities_at: string | null
          severity: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_generated?: boolean | null
          created_at?: string
          description?: string | null
          evidence_data?: Json | null
          freight_id: string
          id?: string
          incident_type: string
          last_known_lat?: number | null
          last_known_lng?: number | null
          operator_id?: string | null
          reported_to_authorities_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_generated?: boolean | null
          created_at?: string
          description?: string | null
          evidence_data?: Json | null
          freight_id?: string
          id?: string
          incident_type?: string
          last_known_lat?: number | null
          last_known_lng?: number | null
          operator_id?: string | null
          reported_to_authorities_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_logs_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
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
      notification_preferences: {
        Row: {
          chat_messages_enabled: boolean | null
          created_at: string | null
          email_enabled: boolean | null
          id: string
          new_freights_enabled: boolean | null
          new_services_enabled: boolean | null
          payments_completed_enabled: boolean | null
          proposals_received_enabled: boolean | null
          push_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_messages_enabled?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          new_freights_enabled?: boolean | null
          new_services_enabled?: boolean | null
          payments_completed_enabled?: boolean | null
          proposals_received_enabled?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_messages_enabled?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          new_freights_enabled?: boolean | null
          new_services_enabled?: boolean | null
          payments_completed_enabled?: boolean | null
          proposals_received_enabled?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      payments: {
        Row: {
          amount_paid: number | null
          amount_total: number
          created_at: string | null
          driver_id: string
          freight_id: string
          id: string
          payment_method: string
          payment_status: string
          producer_id: string
          stripe_payment_id: string | null
          stripe_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          amount_total: number
          created_at?: string | null
          driver_id: string
          freight_id: string
          id?: string
          payment_method: string
          payment_status?: string
          producer_id: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          amount_total?: number
          created_at?: string | null
          driver_id?: string
          freight_id?: string
          id?: string
          payment_method?: string
          payment_status?: string
          producer_id?: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
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
      plans: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          monthly_fee: number
          name: string
          percentage_fee: number
          plan_type: Database["public"]["Enums"]["plan_type"]
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_fee?: number
          name: string
          percentage_fee?: number
          plan_type: Database["public"]["Enums"]["plan_type"]
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_fee?: number
          name?: string
          percentage_fee?: number
          plan_type?: Database["public"]["Enums"]["plan_type"]
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          created_at: string
          free_freight_percentage: number | null
          free_freights_count: number | null
          freight_percentage: number | null
          id: string
          monthly_fee: number | null
          plan_type: string
          updated_at: string
          vehicle_category: string
        }
        Insert: {
          created_at?: string
          free_freight_percentage?: number | null
          free_freights_count?: number | null
          freight_percentage?: number | null
          id?: string
          monthly_fee?: number | null
          plan_type: string
          updated_at?: string
          vehicle_category: string
        }
        Update: {
          created_at?: string
          free_freight_percentage?: number | null
          free_freights_count?: number | null
          freight_percentage?: number | null
          id?: string
          monthly_fee?: number | null
          plan_type?: string
          updated_at?: string
          vehicle_category?: string
        }
        Relationships: []
      }
      producer_service_areas: {
        Row: {
          city_name: string
          created_at: string | null
          geom: unknown
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          producer_id: string
          radius_km: number
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city_name: string
          created_at?: string | null
          geom?: unknown
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          producer_id: string
          radius_km?: number
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city_name?: string
          created_at?: string | null
          geom?: unknown
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          producer_id?: string
          radius_km?: number
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_producer_id"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_mode: string | null
          address_city: string | null
          address_city_id: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_proof_url: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          antt_number: string | null
          aprovado: boolean | null
          background_check_status: string | null
          base_city_id: string | null
          base_city_name: string | null
          base_lat: number | null
          base_lng: number | null
          base_state: string | null
          cnh_category: string | null
          cnh_expiry_date: string | null
          cnh_photo_url: string | null
          cnh_url: string | null
          cnh_validation_status: string | null
          contact_phone: string | null
          cooperative: string | null
          cpf_cnpj: string
          created_at: string
          current_city_name: string | null
          current_location_lat: number | null
          current_location_lng: number | null
          current_state: string | null
          document: string | null
          document_cpf_url: string | null
          document_photo_url: string | null
          document_rg_url: string | null
          document_validation_status: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          farm_address: string | null
          farm_lat: number | null
          farm_lng: number | null
          farm_name: string | null
          fixed_address: string | null
          full_name: string
          id: string
          invoice_number: string | null
          last_gps_update: string | null
          license_plate_photo_url: string | null
          live_cargo_experience: boolean | null
          location_enabled: boolean | null
          metadata: Json | null
          phone: string | null
          profile_photo_url: string | null
          rating: number | null
          rating_locked: boolean | null
          rating_sum: number | null
          rntrc: string | null
          rntrc_validation_status: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          selfie_url: string | null
          service_cities: string[] | null
          service_radius_km: number | null
          service_regions: string[] | null
          service_states: string[] | null
          service_types: string[] | null
          status: Database["public"]["Enums"]["user_status"]
          total_ratings: number | null
          truck_documents_url: string | null
          truck_photo_url: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string | null
          vehicle_other_type: string | null
          vehicle_specifications: string | null
        }
        Insert: {
          active_mode?: string | null
          address_city?: string | null
          address_city_id?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_proof_url?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          antt_number?: string | null
          aprovado?: boolean | null
          background_check_status?: string | null
          base_city_id?: string | null
          base_city_name?: string | null
          base_lat?: number | null
          base_lng?: number | null
          base_state?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_photo_url?: string | null
          cnh_url?: string | null
          cnh_validation_status?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj: string
          created_at?: string
          current_city_name?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          current_state?: string | null
          document?: string | null
          document_cpf_url?: string | null
          document_photo_url?: string | null
          document_rg_url?: string | null
          document_validation_status?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          farm_address?: string | null
          farm_lat?: number | null
          farm_lng?: number | null
          farm_name?: string | null
          fixed_address?: string | null
          full_name: string
          id?: string
          invoice_number?: string | null
          last_gps_update?: string | null
          license_plate_photo_url?: string | null
          live_cargo_experience?: boolean | null
          location_enabled?: boolean | null
          metadata?: Json | null
          phone?: string | null
          profile_photo_url?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: string | null
          rntrc_validation_status?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          selfie_url?: string | null
          service_cities?: string[] | null
          service_radius_km?: number | null
          service_regions?: string[] | null
          service_states?: string[] | null
          service_types?: string[] | null
          status?: Database["public"]["Enums"]["user_status"]
          total_ratings?: number | null
          truck_documents_url?: string | null
          truck_photo_url?: string | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
          vehicle_other_type?: string | null
          vehicle_specifications?: string | null
        }
        Update: {
          active_mode?: string | null
          address_city?: string | null
          address_city_id?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_proof_url?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          antt_number?: string | null
          aprovado?: boolean | null
          background_check_status?: string | null
          base_city_id?: string | null
          base_city_name?: string | null
          base_lat?: number | null
          base_lng?: number | null
          base_state?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_photo_url?: string | null
          cnh_url?: string | null
          cnh_validation_status?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj?: string
          created_at?: string
          current_city_name?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          current_state?: string | null
          document?: string | null
          document_cpf_url?: string | null
          document_photo_url?: string | null
          document_rg_url?: string | null
          document_validation_status?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          farm_address?: string | null
          farm_lat?: number | null
          farm_lng?: number | null
          farm_name?: string | null
          fixed_address?: string | null
          full_name?: string
          id?: string
          invoice_number?: string | null
          last_gps_update?: string | null
          license_plate_photo_url?: string | null
          live_cargo_experience?: boolean | null
          location_enabled?: boolean | null
          metadata?: Json | null
          phone?: string | null
          profile_photo_url?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: string | null
          rntrc_validation_status?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          selfie_url?: string | null
          service_cities?: string[] | null
          service_radius_km?: number | null
          service_regions?: string[] | null
          service_states?: string[] | null
          service_types?: string[] | null
          status?: Database["public"]["Enums"]["user_status"]
          total_ratings?: number | null
          truck_documents_url?: string | null
          truck_photo_url?: string | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
          vehicle_other_type?: string | null
          vehicle_specifications?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_address_city_id_fkey"
            columns: ["address_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_address_city_id_fkey"
            columns: ["address_city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "profiles_base_city_id_fkey"
            columns: ["base_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_base_city_id_fkey"
            columns: ["base_city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "profiles_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      proposal_reminders: {
        Row: {
          id: string
          proposal_id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          id?: string
          proposal_id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_reminders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "freight_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_users: {
        Row: {
          blacklist_reason: string | null
          converted_to_user_id: string | null
          created_at: string | null
          document: string
          document_type: string
          email: string | null
          first_request_date: string | null
          full_name: string
          id: string
          is_blacklisted: boolean | null
          last_city: string | null
          last_request_date: string | null
          last_state: string | null
          metadata: Json | null
          phone: string
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          blacklist_reason?: string | null
          converted_to_user_id?: string | null
          created_at?: string | null
          document: string
          document_type: string
          email?: string | null
          first_request_date?: string | null
          full_name: string
          id?: string
          is_blacklisted?: boolean | null
          last_city?: string | null
          last_request_date?: string | null
          last_state?: string | null
          metadata?: Json | null
          phone: string
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          blacklist_reason?: string | null
          converted_to_user_id?: string | null
          created_at?: string | null
          document?: string
          document_type?: string
          email?: string | null
          first_request_date?: string | null
          full_name?: string
          id?: string
          is_blacklisted?: boolean | null
          last_city?: string | null
          last_request_date?: string | null
          last_state?: string | null
          metadata?: Json | null
          phone?: string
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provider_notification_limits: {
        Row: {
          created_at: string | null
          id: string
          max_notifications_per_hour: number | null
          notification_count: number | null
          provider_id: string
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_notifications_per_hour?: number | null
          notification_count?: number | null
          provider_id: string
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_notifications_per_hour?: number | null
          notification_count?: number | null
          provider_id?: string
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          p256dh_key: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_violations: {
        Row: {
          blocked_until: string | null
          created_at: string | null
          endpoint: string
          first_violation_at: string | null
          id: string
          ip_address: unknown
          last_violation_at: string | null
          user_id: string | null
          violation_count: number | null
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint: string
          first_violation_at?: string | null
          id?: string
          ip_address: unknown
          last_violation_at?: string | null
          user_id?: string | null
          violation_count?: number | null
        }
        Update: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint?: string
          first_violation_at?: string | null
          id?: string
          ip_address?: unknown
          last_violation_at?: string | null
          user_id?: string | null
          violation_count?: number | null
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
      role_correction_audit: {
        Row: {
          corrected_by: string
          correction_reason: string
          created_at: string | null
          id: string
          metadata: Json | null
          new_role: string
          old_role: string
          profile_id: string | null
          user_id: string | null
        }
        Insert: {
          corrected_by: string
          correction_reason: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_role: string
          old_role: string
          profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          corrected_by?: string
          correction_reason?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_role?: string
          old_role?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_correction_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          admin_profile_id: string | null
          alert_type: string
          created_at: string
          details: Json
          id: string
          ip_address: unknown
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          target_user_email: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_profile_id?: string | null
          alert_type: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: unknown
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          target_user_email?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_profile_id?: string | null
          alert_type?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: unknown
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          target_user_email?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          resource: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_blacklist: {
        Row: {
          blocked_at: string | null
          blocked_until: string | null
          created_by: string | null
          id: string
          ip_address: unknown
          is_permanent: boolean | null
          notes: string | null
          reason: string
          user_id: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_until?: string | null
          created_by?: string | null
          id?: string
          ip_address?: unknown
          is_permanent?: boolean | null
          notes?: string | null
          reason: string
          user_id?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_until?: string | null
          created_by?: string | null
          id?: string
          ip_address?: unknown
          is_permanent?: boolean | null
          notes?: string | null
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sensitive_data_access_log: {
        Row: {
          access_type: string | null
          accessed_at: string | null
          id: string
          ip_address: unknown
          request_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          access_type?: string | null
          accessed_at?: string | null
          id?: string
          ip_address?: unknown
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          access_type?: string | null
          accessed_at?: string | null
          id?: string
          ip_address?: unknown
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_matches: {
        Row: {
          created_at: string | null
          distance_m: number | null
          id: string
          match_score: number | null
          match_type: string
          notified_at: string | null
          provider_area_id: string
          provider_id: string
          service_compatibility_score: number | null
          service_request_id: string
        }
        Insert: {
          created_at?: string | null
          distance_m?: number | null
          id?: string
          match_score?: number | null
          match_type: string
          notified_at?: string | null
          provider_area_id: string
          provider_id: string
          service_compatibility_score?: number | null
          service_request_id: string
        }
        Update: {
          created_at?: string | null
          distance_m?: number | null
          id?: string
          match_score?: number | null
          match_type?: string
          notified_at?: string | null
          provider_area_id?: string
          provider_id?: string
          service_compatibility_score?: number | null
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_matches_provider_area_id_fkey"
            columns: ["provider_area_id"]
            isOneToOne: false
            referencedRelation: "service_provider_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      service_messages: {
        Row: {
          chat_closed_by: Json | null
          created_at: string
          id: string
          image_url: string | null
          message: string
          message_type: string
          read_at: string | null
          sender_id: string
          service_request_id: string
        }
        Insert: {
          chat_closed_by?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          message: string
          message_type?: string
          read_at?: string | null
          sender_id: string
          service_request_id: string
        }
        Update: {
          chat_closed_by?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string
          message_type?: string
          read_at?: string | null
          sender_id?: string
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_messages_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          metadata: Json | null
          net_amount: number | null
          payment_method: string
          platform_fee: number | null
          processed_at: string | null
          provider_id: string
          service_request_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          payment_method?: string
          platform_fee?: number | null
          processed_at?: string | null
          provider_id: string
          service_request_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          payment_method?: string
          platform_fee?: number | null
          processed_at?: string | null
          provider_id?: string
          service_request_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_provider_areas: {
        Row: {
          city_name: string
          created_at: string | null
          geom: unknown
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          provider_id: string
          radius_km: number
          radius_m: number | null
          service_area: unknown
          service_types: string[] | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city_name: string
          created_at?: string | null
          geom?: unknown
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          provider_id: string
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown
          service_types?: string[] | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city_name?: string
          created_at?: string | null
          geom?: unknown
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          provider_id?: string
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown
          service_types?: string[] | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_provider_areas_provider"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_provider_balances: {
        Row: {
          available_balance: number
          created_at: string
          id: string
          last_payout_at: string | null
          pending_balance: number
          provider_id: string
          total_earned: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          id?: string
          last_payout_at?: string | null
          pending_balance?: number
          provider_id: string
          total_earned?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          id?: string
          last_payout_at?: string | null
          pending_balance?: number
          provider_id?: string
          total_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_provider_balances_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_provider_payout_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          pix_key: string
          processed_at: string | null
          processed_by: string | null
          provider_id: string
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          pix_key: string
          processed_at?: string | null
          processed_by?: string | null
          provider_id: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          pix_key?: string
          processed_at?: string | null
          processed_by?: string | null
          provider_id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_provider_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          processed_at: string | null
          provider_id: string
          service_request_id: string
          status: string
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          provider_id: string
          service_request_id: string
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          provider_id?: string
          service_request_id?: string
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_providers: {
        Row: {
          base_price: number | null
          certifications: string[] | null
          created_at: string
          emergency_service: boolean | null
          equipment_description: string | null
          hourly_rate: number | null
          id: string
          profile_id: string
          service_area_cities: string[] | null
          service_radius_km: number | null
          service_type: string
          specialties: string[] | null
          updated_at: string
          work_hours_end: string | null
          work_hours_start: string | null
          works_holidays: boolean | null
          works_weekends: boolean | null
        }
        Insert: {
          base_price?: number | null
          certifications?: string[] | null
          created_at?: string
          emergency_service?: boolean | null
          equipment_description?: string | null
          hourly_rate?: number | null
          id?: string
          profile_id: string
          service_area_cities?: string[] | null
          service_radius_km?: number | null
          service_type: string
          specialties?: string[] | null
          updated_at?: string
          work_hours_end?: string | null
          work_hours_start?: string | null
          works_holidays?: boolean | null
          works_weekends?: boolean | null
        }
        Update: {
          base_price?: number | null
          certifications?: string[] | null
          created_at?: string
          emergency_service?: boolean | null
          equipment_description?: string | null
          hourly_rate?: number | null
          id?: string
          profile_id?: string
          service_area_cities?: string[] | null
          service_radius_km?: number | null
          service_type?: string
          specialties?: string[] | null
          updated_at?: string
          work_hours_end?: string | null
          work_hours_start?: string | null
          works_holidays?: boolean | null
          works_weekends?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rated_user_id: string
          rater_id: string
          rating: number
          rating_type: string
          service_request_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_user_id: string
          rater_id: string
          rating: number
          rating_type: string
          service_request_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_user_id?: string
          rater_id?: string
          rating?: number
          rating_type?: string
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_ratings_rated_user_id_fkey"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          accepted_at: string | null
          additional_info: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          city_id: string | null
          city_lat: number | null
          city_lng: number | null
          city_name: string | null
          client_comment: string | null
          client_id: string | null
          client_rating: number | null
          completed_at: string | null
          contact_document: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string
          contact_phone_encrypted: string | null
          created_at: string
          estimated_price: number | null
          final_price: number | null
          id: string
          is_emergency: boolean | null
          location_address: string
          location_address_encrypted: string | null
          location_city: string | null
          location_lat: number | null
          location_lng: number | null
          location_state: string | null
          preferred_datetime: string | null
          problem_description: string
          prospect_user_id: string | null
          provider_comment: string | null
          provider_id: string | null
          provider_notes: string | null
          provider_rating: number | null
          service_radius_km: number | null
          service_type: string
          state: string | null
          status: string
          updated_at: string
          urgency: string
          vehicle_info: string | null
        }
        Insert: {
          accepted_at?: string | null
          additional_info?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city_id?: string | null
          city_lat?: number | null
          city_lng?: number | null
          city_name?: string | null
          client_comment?: string | null
          client_id?: string | null
          client_rating?: number | null
          completed_at?: string | null
          contact_document?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone: string
          contact_phone_encrypted?: string | null
          created_at?: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          is_emergency?: boolean | null
          location_address: string
          location_address_encrypted?: string | null
          location_city?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_state?: string | null
          preferred_datetime?: string | null
          problem_description: string
          prospect_user_id?: string | null
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          service_radius_km?: number | null
          service_type: string
          state?: string | null
          status?: string
          updated_at?: string
          urgency?: string
          vehicle_info?: string | null
        }
        Update: {
          accepted_at?: string | null
          additional_info?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city_id?: string | null
          city_lat?: number | null
          city_lng?: number | null
          city_name?: string | null
          client_comment?: string | null
          client_id?: string | null
          client_rating?: number | null
          completed_at?: string | null
          contact_document?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string
          contact_phone_encrypted?: string | null
          created_at?: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          is_emergency?: boolean | null
          location_address?: string
          location_address_encrypted?: string | null
          location_city?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_state?: string | null
          preferred_datetime?: string | null
          problem_description?: string
          prospect_user_id?: string | null
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          service_radius_km?: number | null
          service_type?: string
          state?: string | null
          status?: string
          updated_at?: string
          urgency?: string
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_requests_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_service_requests_provider"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "service_requests_prospect_user_id_fkey"
            columns: ["prospect_user_id"]
            isOneToOne: false
            referencedRelation: "prospect_users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end_date: string | null
          subscription_id: string | null
          subscription_tier: string | null
          tier: string | null
          updated_at: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end_date?: string | null
          subscription_id?: string | null
          subscription_tier?: string | null
          tier?: string | null
          updated_at?: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end_date?: string | null
          subscription_id?: string | null
          subscription_tier?: string | null
          tier?: string | null
          updated_at?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_fees: {
        Row: {
          created_at: string | null
          fee_amount: number
          fee_percentage: number
          freight_amount: number
          freight_id: string | null
          id: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fee_amount: number
          fee_percentage: number
          freight_amount: number
          freight_id?: string | null
          id?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fee_amount?: number
          fee_percentage?: number
          freight_amount?: number
          freight_id?: string | null
          id?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_fees_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_fees_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
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
      system_announcements: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          message: string
          priority: number | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          priority?: number | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          priority?: number | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_message_queue: {
        Row: {
          created_at: string | null
          error_log_id: string | null
          id: string
          last_retry_at: string | null
          message: string
          retry_count: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_log_id?: string | null
          id?: string
          last_retry_at?: string | null
          message: string
          retry_count?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_log_id?: string | null
          id?: string
          last_retry_at?: string | null
          message?: string
          retry_count?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_message_queue_error_log_id_fkey"
            columns: ["error_log_id"]
            isOneToOne: false
            referencedRelation: "error_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_consents: {
        Row: {
          consent_given: boolean
          consent_text: string
          created_at: string
          freight_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_given?: boolean
          consent_text: string
          created_at?: string
          freight_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_given?: boolean
          consent_text?: string
          created_at?: string
          freight_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_consents_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      transport_companies: {
        Row: {
          address: string | null
          antt_document_url: string | null
          antt_registration: string | null
          approved_at: string | null
          approved_by: string | null
          city: string | null
          cnpj_document_url: string | null
          company_cnpj: string
          company_name: string
          created_at: string | null
          id: string
          municipal_registration: string | null
          profile_id: string
          state: string | null
          state_registration: string | null
          status: string | null
          updated_at: string | null
          validation_notes: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          antt_document_url?: string | null
          antt_registration?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          cnpj_document_url?: string | null
          company_cnpj: string
          company_name: string
          created_at?: string | null
          id?: string
          municipal_registration?: string | null
          profile_id: string
          state?: string | null
          state_registration?: string | null
          status?: string | null
          updated_at?: string | null
          validation_notes?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          antt_document_url?: string | null
          antt_registration?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          cnpj_document_url?: string | null
          company_cnpj?: string
          company_name?: string
          created_at?: string | null
          id?: string
          municipal_registration?: string | null
          profile_id?: string
          state?: string | null
          state_registration?: string | null
          status?: string | null
          updated_at?: string | null
          validation_notes?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_companies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_companies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          freight_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          source: string | null
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          freight_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          source?: string | null
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          freight_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          source?: string | null
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_locations_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_entities: {
        Row: {
          added_at: string | null
          added_by: string
          entity_type: string
          entity_value: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          reason: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          entity_type: string
          entity_value: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          reason: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          entity_type?: string
          entity_value?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      urban_service_providers: {
        Row: {
          base_price: number | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          emergency_service: boolean | null
          equipment_description: string | null
          id: string
          insurance_coverage: number | null
          license_number: string | null
          price_per_kg: number | null
          price_per_km: number | null
          profile_id: string
          service_area_cities: string[] | null
          service_radius_km: number | null
          service_types: string[]
          specialties: string[] | null
          updated_at: string
          vehicle_capacity_kg: number | null
          vehicle_capacity_m3: number | null
          vehicle_types: string[] | null
          work_hours_end: string | null
          work_hours_start: string | null
          works_holidays: boolean | null
          works_weekends: boolean | null
        }
        Insert: {
          base_price?: number | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          emergency_service?: boolean | null
          equipment_description?: string | null
          id?: string
          insurance_coverage?: number | null
          license_number?: string | null
          price_per_kg?: number | null
          price_per_km?: number | null
          profile_id: string
          service_area_cities?: string[] | null
          service_radius_km?: number | null
          service_types?: string[]
          specialties?: string[] | null
          updated_at?: string
          vehicle_capacity_kg?: number | null
          vehicle_capacity_m3?: number | null
          vehicle_types?: string[] | null
          work_hours_end?: string | null
          work_hours_start?: string | null
          works_holidays?: boolean | null
          works_weekends?: boolean | null
        }
        Update: {
          base_price?: number | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          emergency_service?: boolean | null
          equipment_description?: string | null
          id?: string
          insurance_coverage?: number | null
          license_number?: string | null
          price_per_kg?: number | null
          price_per_km?: number | null
          profile_id?: string
          service_area_cities?: string[] | null
          service_radius_km?: number | null
          service_types?: string[]
          specialties?: string[] | null
          updated_at?: string
          vehicle_capacity_kg?: number | null
          vehicle_capacity_m3?: number | null
          vehicle_types?: string[] | null
          work_hours_end?: string | null
          work_hours_start?: string | null
          works_holidays?: boolean | null
          works_weekends?: boolean | null
        }
        Relationships: []
      }
      urban_service_requests: {
        Row: {
          accepted_at: string | null
          additional_services: string[] | null
          client_id: string
          completed_at: string | null
          contact_phone: string
          contact_phone_encrypted: string | null
          created_at: string
          delivery_date: string | null
          destination_address: string
          destination_address_encrypted: string | null
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          estimated_volume: number | null
          estimated_weight: number | null
          id: string
          notes: string | null
          origin_address: string
          origin_address_encrypted: string | null
          origin_lat: number | null
          origin_lng: number | null
          package_dimensions: string | null
          pickup_date: string
          price: number | null
          provider_id: string | null
          service_type: string
          special_items: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          additional_services?: string[] | null
          client_id: string
          completed_at?: string | null
          contact_phone: string
          contact_phone_encrypted?: string | null
          created_at?: string
          delivery_date?: string | null
          destination_address: string
          destination_address_encrypted?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          estimated_volume?: number | null
          estimated_weight?: number | null
          id?: string
          notes?: string | null
          origin_address: string
          origin_address_encrypted?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          package_dimensions?: string | null
          pickup_date: string
          price?: number | null
          provider_id?: string | null
          service_type: string
          special_items?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          additional_services?: string[] | null
          client_id?: string
          completed_at?: string | null
          contact_phone?: string
          contact_phone_encrypted?: string | null
          created_at?: string
          delivery_date?: string | null
          destination_address?: string
          destination_address_encrypted?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          estimated_volume?: number | null
          estimated_weight?: number | null
          id?: string
          notes?: string | null
          origin_address?: string
          origin_address_encrypted?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          package_dimensions?: string | null
          pickup_date?: string
          price?: number | null
          provider_id?: string | null
          service_type?: string
          special_items?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string | null
          id: string
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string | null
          id?: string
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string | null
          id?: string
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "system_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cities: {
        Row: {
          city_id: string
          created_at: string
          id: string
          is_active: boolean
          radius_km: number
          service_types: string[] | null
          type: Database["public"]["Enums"]["user_city_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          radius_km?: number
          service_types?: string[] | null
          type: Database["public"]["Enums"]["user_city_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          radius_km?: number
          service_types?: string[] | null
          type?: Database["public"]["Enums"]["user_city_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
        ]
      }
      user_devices: {
        Row: {
          browser: string | null
          camera_enabled: boolean | null
          created_at: string | null
          device_id: string
          device_name: string | null
          device_type: string | null
          id: string
          is_active: boolean | null
          last_active_at: string | null
          last_location: unknown
          location_enabled: boolean | null
          microphone_enabled: boolean | null
          os: string | null
          push_enabled: boolean | null
          storage_enabled: boolean | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          camera_enabled?: boolean | null
          created_at?: string | null
          device_id: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_active_at?: string | null
          last_location?: unknown
          location_enabled?: boolean | null
          microphone_enabled?: boolean | null
          os?: string | null
          push_enabled?: boolean | null
          storage_enabled?: boolean | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          camera_enabled?: boolean | null
          created_at?: string | null
          device_id?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_active_at?: string | null
          last_location?: unknown
          location_enabled?: boolean | null
          microphone_enabled?: boolean | null
          os?: string | null
          push_enabled?: boolean | null
          storage_enabled?: boolean | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_reports: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          report_type: string
          reported_user_id: string
          reported_user_name: string
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          report_type?: string
          reported_user_id: string
          reported_user_name: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          report_type?: string
          reported_user_id?: string
          reported_user_name?: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          ends_at: string | null
          id: string
          plan_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          ends_at?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
          assigned_driver_id: string | null
          axle_count: number
          company_id: string | null
          created_at: string
          crlv_expiry_date: string | null
          crlv_url: string | null
          driver_id: string
          high_performance: boolean | null
          id: string
          inspection_certificate_url: string | null
          insurance_document_url: string | null
          insurance_expiry_date: string | null
          is_company_vehicle: boolean | null
          last_inspection_date: string | null
          license_plate: string
          max_capacity_tons: number
          primary_identification: string | null
          status: string
          updated_at: string
          vehicle_documents: Json | null
          vehicle_photo_url: string | null
          vehicle_photos: Json | null
          vehicle_specifications: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vehicle_validation_status: string | null
        }
        Insert: {
          assigned_driver_id?: string | null
          axle_count?: number
          company_id?: string | null
          created_at?: string
          crlv_expiry_date?: string | null
          crlv_url?: string | null
          driver_id: string
          high_performance?: boolean | null
          id?: string
          inspection_certificate_url?: string | null
          insurance_document_url?: string | null
          insurance_expiry_date?: string | null
          is_company_vehicle?: boolean | null
          last_inspection_date?: string | null
          license_plate: string
          max_capacity_tons: number
          primary_identification?: string | null
          status?: string
          updated_at?: string
          vehicle_documents?: Json | null
          vehicle_photo_url?: string | null
          vehicle_photos?: Json | null
          vehicle_specifications?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vehicle_validation_status?: string | null
        }
        Update: {
          assigned_driver_id?: string | null
          axle_count?: number
          company_id?: string | null
          created_at?: string
          crlv_expiry_date?: string | null
          crlv_url?: string | null
          driver_id?: string
          high_performance?: boolean | null
          id?: string
          inspection_certificate_url?: string | null
          insurance_document_url?: string | null
          insurance_expiry_date?: string | null
          is_company_vehicle?: boolean | null
          last_inspection_date?: string | null
          license_plate?: string
          max_capacity_tons?: number
          primary_identification?: string | null
          status?: string
          updated_at?: string
          vehicle_documents?: Json | null
          vehicle_photo_url?: string | null
          vehicle_photos?: Json | null
          vehicle_specifications?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          vehicle_validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
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
      city_hierarchy: {
        Row: {
          active_freights_destination: number | null
          active_freights_origin: number | null
          active_services: number | null
          city_id: string | null
          city_name: string | null
          city_state: string | null
          lat: number | null
          lng: number | null
          total_drivers: number | null
          total_producers: number | null
          total_providers: number | null
          total_users: number | null
        }
        Relationships: []
      }
      company_invite_links: {
        Row: {
          company_id: string | null
          company_name: string | null
          id: string | null
          invite_code: string | null
          invite_link: string | null
          invite_type: string | null
          invited_email: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_service_request: {
        Args: { p_provider_id: string; p_request_id: string }
        Returns: {
          accepted_at: string
          id: string
          provider_id: string
          status: string
        }[]
      }
      auto_cancel_overdue_freights: { Args: never; Returns: Json }
      auto_confirm_deliveries: { Args: never; Returns: Json }
      auto_insert_city: {
        Args: {
          city_name: string
          latitude?: number
          longitude?: number
          state_name: string
        }
        Returns: string
      }
      calculate_antt_minimum_price: {
        Args: {
          cargo_type_param: string
          destination_state: string
          distance_km: number
          origin_state: string
          weight_kg: number
        }
        Returns: number
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      calculate_distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      can_manage_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_notify_driver: { Args: { p_driver_id: string }; Returns: boolean }
      can_notify_provider: { Args: { p_provider_id: string }; Returns: boolean }
      can_view_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { _target_profile: string; _viewer: string }
        Returns: boolean
      }
      cancel_accepted_service: {
        Args: {
          p_cancellation_reason?: string
          p_provider_id: string
          p_request_id: string
        }
        Returns: {
          cancellation_reason: string
          cancelled_at: string
          id: string
          provider_id: string
          status: string
        }[]
      }
      cancel_freight_optimized: {
        Args: {
          p_cancellation_reason?: string
          p_freight_id: string
          p_new_pickup_date: string
        }
        Returns: boolean
      }
      check_admin_reset_rate_limit: {
        Args: { p_admin_profile_id: string }
        Returns: Json
      }
      check_error_report_rate_limit: {
        Args: { p_endpoint?: string; p_ip_address: string }
        Returns: Json
      }
      check_expired_documents: { Args: never; Returns: undefined }
      check_guest_validation_rate_limit: {
        Args: { p_ip_address: string }
        Returns: Json
      }
      check_low_ratings: { Args: never; Returns: undefined }
      check_mutual_ratings_complete: {
        Args: { freight_id_param: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          endpoint_name: string
          max_requests?: number
          time_window?: unknown
        }
        Returns: boolean
      }
      cities_needing_geocoding: {
        Args: never
        Returns: {
          id: string
          name: string
          state: string
        }[]
      }
      cleanup_expired_requests: { Args: never; Returns: undefined }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      confirm_checkin_as_counterpart: {
        Args: { p_checkin_id: string; p_observations?: string }
        Returns: boolean
      }
      confirm_delivery: { Args: { freight_id_param: string }; Returns: Json }
      decrypt_document: {
        Args: { encrypted_doc: string; original_doc: string }
        Returns: string
      }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string; key?: string }
        Returns: string
      }
      detect_suspicious_access: {
        Args: { rows_accessed: number; table_accessed: string }
        Returns: boolean
      }
      detect_suspicious_admin_activity: {
        Args: {
          p_activity_type: string
          p_admin_profile_id: string
          p_details?: Json
        }
        Returns: undefined
      }
      driver_update_freight_status: {
        Args: {
          p_freight_id: string
          p_location?: Json
          p_new_status: string
          p_notes?: string
          p_user_id: string
        }
        Returns: Json
      }
      encrypt_document: { Args: { doc: string }; Returns: string }
      encrypt_sensitive_data: {
        Args: { data: string; key?: string }
        Returns: string
      }
      ensure_current_user_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      execute_freight_matching: {
        Args: { freight_uuid: string }
        Returns: {
          distance_m: number
          driver_area_id: string
          driver_id: string
          match_score: number
          match_type: string
        }[]
      }
      execute_service_matching: {
        Args: {
          p_request_lat: number
          p_request_lng: number
          p_service_request_id: string
          p_service_type?: string
        }
        Returns: {
          distance_m: number
          match_score: number
          match_type: string
          provider_area_id: string
          provider_id: string
          service_compatibility_score: number
        }[]
      }
      execute_service_matching_with_user_cities: {
        Args: {
          p_request_lat: number
          p_request_lng: number
          p_service_request_id: string
          p_service_type?: string
        }
        Returns: {
          distance_m: number
          match_score: number
          match_type: string
          provider_city_id: string
          provider_id: string
          service_compatibility_score: number
        }[]
      }
      find_company_by_cnpj: {
        Args: { p_cnpj: string }
        Returns: {
          company_name: string
          id: string
          status: string
        }[]
      }
      find_drivers_by_origin:
        | {
            Args: { origin_city_param: string; origin_state_param: string }
            Returns: {
              distance_km: number
              driver_id: string
              driver_name: string
              driver_rating: number
              service_types: string[]
            }[]
          }
        | {
            Args: { freight_uuid: string }
            Returns: {
              distance_m: number
              driver_area_id: string
              driver_id: string
              match_method: string
              radius_km: number
            }[]
          }
      find_drivers_by_route:
        | {
            Args: {
              destination_city_param: string
              destination_state_param: string
              origin_city_param: string
              origin_state_param: string
            }
            Returns: {
              driver_id: string
              driver_name: string
              driver_rating: number
              match_score: number
              service_types: string[]
            }[]
          }
        | {
            Args: { freight_uuid: string }
            Returns: {
              distance_to_route_m: number
              driver_area_id: string
              driver_id: string
              match_method: string
              radius_km: number
            }[]
          }
      find_providers_by_location: {
        Args: { request_id: string; request_lat: number; request_lng: number }
        Returns: {
          city_name: string
          distance_m: number
          match_method: string
          provider_area_id: string
          provider_id: string
          radius_km: number
          service_types: string[]
        }[]
      }
      find_providers_by_service_and_location: {
        Args: {
          request_id: string
          request_lat: number
          request_lng: number
          required_service_type: string
        }
        Returns: {
          city_name: string
          distance_m: number
          provider_area_id: string
          provider_id: string
          radius_km: number
          service_match: boolean
          service_types: string[]
        }[]
      }
      fix_freight_status_for_partial_bookings: {
        Args: never
        Returns: {
          accepted_trucks: number
          available_slots: number
          freight_id: string
          new_status: Database["public"]["Enums"]["freight_status"]
          old_status: Database["public"]["Enums"]["freight_status"]
          required_trucks: number
        }[]
      }
      fix_freight_statuses: {
        Args: never
        Returns: {
          freight_id: string
          new_status: string
          old_status: string
        }[]
      }
      generate_admin_report: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_report_type: string
        }
        Returns: string
      }
      generate_invite_code: { Args: never; Returns: string }
      get_compatible_freights_for_driver: {
        Args: { p_driver_id: string }
        Returns: {
          cargo_type: string
          created_at: string
          delivery_date: string
          destination_city: string
          destination_lat: number
          destination_lng: number
          freight_id: string
          origin_city: string
          origin_lat: number
          origin_lng: number
          pickup_date: string
          price: number
          producer_id: string
          status: Database["public"]["Enums"]["freight_status"]
          urgency: string
          weight: number
        }[]
      }
      get_compatible_freights_for_driver_v2: {
        Args: { p_driver_id: string }
        Returns: {
          accepted_trucks: number
          available_slots: number
          cargo_type: string
          created_at: string
          delivery_date: string
          destination_address: string
          destination_city: string
          destination_lat: number
          destination_lng: number
          destination_state: string
          distance_km: number
          distance_m: number
          id: string
          is_full_booking: boolean
          is_partial_booking: boolean
          match_score: number
          origin_address: string
          origin_city: string
          origin_lat: number
          origin_lng: number
          origin_state: string
          pickup_date: string
          price: number
          producer_id: string
          required_trucks: number
          scheduled_date: string
          service_type: string
          status: Database["public"]["Enums"]["freight_status"]
          urgency_level: string
          urgent: boolean
          vehicle_type: string
          weight: number
        }[]
      }
      get_compatible_service_requests_for_provider: {
        Args: { p_provider_id: string }
        Returns: {
          additional_info: string
          city_name: string
          client_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          estimated_price: number
          is_emergency: boolean
          location_address: string
          location_lat: number
          location_lng: number
          problem_description: string
          request_id: string
          service_type: string
          state: string
          status: string
          urgency: string
          vehicle_info: string
        }[]
      }
      get_current_user_safe: { Args: never; Returns: string }
      get_email_by_document: { Args: { p_doc: string }; Returns: string }
      get_failed_login_attempts: {
        Args: { min_failures?: number; since_timestamp: string }
        Returns: {
          email: string
          failed_count: number
          ip_addresses: string[]
        }[]
      }
      get_freights_for_driver: {
        Args: { p_driver_id: string }
        Returns: {
          cargo_type: string
          created_at: string
          delivery_date: string
          destination_address: string
          destination_city: string
          destination_state: string
          distance_km: number
          id: string
          origin_address: string
          origin_city: string
          origin_state: string
          pickup_date: string
          price: number
          service_type: string
          status: string
          urgency: string
          weight: number
        }[]
      }
      get_freights_in_city: {
        Args: { p_city_id: string; p_type?: string }
        Returns: {
          cargo_type: string
          created_at: string
          destination_city: string
          destination_state: string
          freight_id: string
          origin_city: string
          origin_state: string
          price: number
          status: Database["public"]["Enums"]["freight_status"]
        }[]
      }
      get_freights_in_provider_region: {
        Args: { provider_user_id: string }
        Returns: {
          cargo_type: string
          created_at: string
          delivery_date: string
          description: string
          destination_address: string
          distance_km: number
          id: string
          origin_address: string
          origin_city: string
          origin_lat: number
          origin_lng: number
          origin_state: string
          pickup_date: string
          price: number
          producer_name: string
          service_type: string
          status: string
          urgency: string
          weight: number
        }[]
      }
      get_freights_in_radius:
        | {
            Args: { p_driver_id: string }
            Returns: {
              cargo_type: string
              created_at: string
              delivery_date: string
              destination_city: string
              destination_lat: number
              destination_lng: number
              destination_state: string
              distance_from_driver: number
              distance_km: number
              id: string
              origin_city: string
              origin_lat: number
              origin_lng: number
              origin_state: string
              pickup_date: string
              price: number
              producer_id: string
              service_type: string
              status: Database["public"]["Enums"]["freight_status"]
              urgency: string
              weight: number
            }[]
          }
        | {
            Args: { p_driver_id: string; radius_km?: number }
            Returns: {
              cargo_type: string
              created_at: string
              delivery_date: string
              destination_city: string
              destination_lat: number
              destination_lng: number
              destination_state: string
              distance_km: number
              freight_id: string
              origin_city: string
              origin_lat: number
              origin_lng: number
              origin_state: string
              pickup_date: string
              price: number
              producer_id: string
              requires_monitoring: boolean
              status: Database["public"]["Enums"]["freight_status"]
              urgency: string
              weight: number
            }[]
          }
      get_multiple_ip_logins: {
        Args: { min_ip_count?: number; since_timestamp: string }
        Returns: {
          email: string
          ip_addresses: string[]
          ip_count: number
        }[]
      }
      get_nearby_freights_for_driver: {
        Args: { p_driver_id: string; p_radius_km?: number }
        Returns: {
          cargo_type: string
          created_at: string
          delivery_date: string
          destination_city: string
          destination_lat: number
          destination_lng: number
          distance_km: number
          freight_id: string
          origin_city: string
          origin_lat: number
          origin_lng: number
          pickup_date: string
          price: number
          producer_id: string
          status: Database["public"]["Enums"]["freight_status"]
          urgency: string
          weight: number
        }[]
      }
      get_platform_stats: {
        Args: never
        Returns: {
          avaliacao_media: number
          fretes_entregues: number
          motoristas: number
          peso_total: number
          produtores: number
          total_fretes: number
          total_usuarios: number
        }[]
      }
      get_provider_service_requests: {
        Args: { provider_profile_id: string }
        Returns: {
          additional_info: string
          client_id: string
          contact_name: string
          contact_phone: string
          contact_phone_safe: string
          created_at: string
          distance_km: number
          estimated_price: number
          id: string
          is_emergency: boolean
          location_address: string
          location_address_safe: string
          preferred_datetime: string
          problem_description: string
          request_source: string
          service_type: string
          status: string
          urgency: string
          vehicle_info: string
        }[]
      }
      get_provider_services_by_city: {
        Args: { p_provider_id: string }
        Returns: {
          city_id: string
          city_name: string
          city_state: string
          is_active: boolean
          radius_km: number
          service_types: string[]
        }[]
      }
      get_public_service_requests: {
        Args: never
        Returns: {
          created_at: string
          destination_city: string
          destination_lat_approx: number
          destination_lng_approx: number
          distance_km: number
          estimated_volume: number
          estimated_weight: number
          id: string
          origin_city: string
          origin_lat_approx: number
          origin_lng_approx: number
          pickup_date: string
          price: number
          service_type: string
          status: string
        }[]
      }
      get_public_stats: {
        Args: never
        Returns: {
          active_freights: number
          total_drivers: number
          total_freights: number
          total_producers: number
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
      get_secure_request_details: {
        Args: { request_id: string }
        Returns: {
          contact_phone: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          origin_address: string
          origin_lat: number
          origin_lng: number
        }[]
      }
      get_secure_service_request_details: {
        Args: { request_id: string }
        Returns: {
          contact_phone: string
          location_address: string
          location_lat: number
          location_lng: number
        }[]
      }
      get_service_requests_by_city: {
        Args: {
          provider_current_city?: string
          provider_current_state?: string
          provider_profile_id: string
        }
        Returns: {
          additional_info: string
          city_name: string
          client_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          is_emergency: boolean
          location_address: string
          location_lat: number
          location_lng: number
          problem_description: string
          service_type: string
          state: string
          status: string
          updated_at: string
          urgency: string
          vehicle_info: string
        }[]
      }
      get_service_requests_for_provider_cities: {
        Args: { p_provider_id: string }
        Returns: {
          city_name: string
          client_id: string
          created_at: string
          description: string
          distance_km: number
          id: string
          location_address: string
          location_lat: number
          location_lng: number
          metadata: Json
          price_range: string
          provider_city_id: string
          provider_city_name: string
          scheduled_date: string
          service_type: string
          state: string
          status: string
          urgency: string
        }[]
      }
      get_service_requests_in_provider_region: {
        Args: { provider_user_id: string }
        Returns: {
          city_name: string
          contact_name: string
          created_at: string
          distance_km: number
          id: string
          is_emergency: boolean
          location_address: string
          location_lat: number
          location_lng: number
          problem_description: string
          service_type: string
          state: string
          status: string
          urgency: string
          vehicle_info: string
        }[]
      }
      get_service_requests_in_radius: {
        Args: { p_provider_id: string }
        Returns: {
          destination_address: string
          distance_m: number
          origin_address: string
          price: number
          request_id: string
          service_type: string
          status: string
        }[]
      }
      get_services_for_provider: {
        Args: { p_provider_id: string }
        Returns: {
          city_name: string
          client_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          distance_km: number
          id: string
          location_address: string
          location_lat: number
          location_lng: number
          problem_description: string
          service_type: string
          state: string
          status: string
          urgency: string
        }[]
      }
      get_services_in_city: {
        Args: { p_city_id: string }
        Returns: {
          city_name: string
          city_state: string
          created_at: string
          estimated_price: number
          service_id: string
          service_type: string
          status: string
        }[]
      }
      get_unusual_hour_logins: {
        Args: {
          end_hour?: number
          since_timestamp: string
          start_hour?: number
        }
        Returns: {
          created_at: string
          email: string
          hour_of_day: number
          ip_address: string
        }[]
      }
      get_user_rating_distribution: {
        Args: { p_user_id: string }
        Returns: {
          count: number
          star_rating: number
        }[]
      }
      get_user_rating_stats: {
        Args: { p_user_id: string }
        Returns: {
          average_rating: number
          five_star: number
          four_star: number
          one_star: number
          three_star: number
          total_ratings: number
          two_star: number
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_users_in_city: {
        Args: {
          p_city_id: string
          p_include_nearby?: boolean
          p_type: Database["public"]["Enums"]["user_city_type"]
        }
        Returns: {
          city_id: string
          city_name: string
          city_state: string
          distance_m: number
          radius_km: number
          user_id: string
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_affiliated_driver: { Args: { p_profile_id: string }; Returns: boolean }
      is_company_driver: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      is_current_user_producer_of_freight: {
        Args: { p_freight_id: string }
        Returns: boolean
      }
      is_driver_visible_for_company: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      is_freight_owner: {
        Args: { freight_id: string; user_profile_id: string }
        Returns: boolean
      }
      is_ip_blacklisted: { Args: { check_ip: unknown }; Returns: boolean }
      is_profile_owner: {
        Args: { _profile_id: string; _viewer: string }
        Returns: boolean
      }
      is_service_compatible: {
        Args: { driver_service_types: string[]; freight_service_type: string }
        Returns: boolean
      }
      is_transport_company: { Args: { p_user_id: string }; Returns: boolean }
      is_trusted_entity: {
        Args: { p_entity_type: string; p_entity_value: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          details?: Json
          event_type: string
          record_id?: string
          table_name: string
        }
        Returns: undefined
      }
      log_sensitive_data_access:
        | {
            Args: { access_type: string; request_id: string }
            Returns: undefined
          }
        | {
            Args: {
              access_type: string
              accessed_id: string
              accessed_table: string
            }
            Returns: undefined
          }
      mark_freight_messages_as_read: {
        Args: { p_freight_id: string }
        Returns: undefined
      }
      mark_service_messages_as_read: {
        Args: { p_service_request_id: string }
        Returns: undefined
      }
      match_drivers_to_freight: {
        Args: { p_freight_id: string }
        Returns: {
          city_match_type: string
          distance_m: number
          driver_id: string
          driver_name: string
          driver_rating: number
          radius_km: number
        }[]
      }
      match_providers_to_service: {
        Args: { p_service_request_id: string }
        Returns: {
          distance_m: number
          provider_id: string
          provider_name: string
          provider_rating: number
          radius_km: number
          service_types: string[]
        }[]
      }
      migrate_freight_requests_to_freights: {
        Args: never
        Returns: {
          from_table: string
          migrated_id: string
          svc_type: string
          to_table: string
        }[]
      }
      process_freight_withdrawal: {
        Args: { driver_profile_id: string; freight_id_param: string }
        Returns: Json
      }
      process_payout_request: {
        Args: {
          amount_param: number
          description_param?: string
          pix_key_param: string
          provider_id_param: string
        }
        Returns: Json
      }
      process_telegram_queue: { Args: never; Returns: Json }
      reopen_freight: { Args: { p_freight_id: string }; Returns: string }
      sanitize_document: { Args: { doc: string }; Returns: string }
      scan_policies_for_role_references: {
        Args: never
        Returns: {
          object_name: string
          object_type: string
          recommendation: string
          violation_details: string
          violation_type: string
        }[]
      }
      search_cities: {
        Args: { limit_count?: number; search_term: string }
        Returns: {
          display_name: string
          id: string
          lat: number
          lng: number
          name: string
          state: string
        }[]
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
      sync_assignment_status_bulk: {
        Args: { assignment_ids: string[]; freight_statuses: string[] }
        Returns: Json
      }
      text_to_freight_status: {
        Args: { p_text: string }
        Returns: Database["public"]["Enums"]["freight_status"]
      }
      update_freight_status: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["freight_status"]
        }
        Returns: {
          accepted_by_company: boolean | null
          accepted_trucks: number
          allow_counter_proposals: boolean | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cargo_category_antt: string | null
          cargo_type: string
          commission_amount: number | null
          commission_rate: number | null
          company_id: string | null
          contact_phone: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          date_range_end: string | null
          date_range_start: string | null
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_city: string | null
          destination_city_id: string | null
          destination_geog: unknown
          destination_lat: number | null
          destination_lng: number | null
          destination_state: string | null
          distance_km: number | null
          driver_id: string | null
          drivers_assigned: string[] | null
          extra_fees: number | null
          extra_fees_description: string | null
          fiscal_documents_url: string | null
          flexible_dates: boolean | null
          guest_contact_document: string | null
          guest_contact_email: string | null
          guest_contact_name: string | null
          guest_contact_phone: string | null
          high_performance: boolean | null
          id: string
          is_full_booking: boolean | null
          is_guest_freight: boolean | null
          is_scheduled: boolean | null
          last_location_update: string | null
          metadata: Json | null
          minimum_antt_price: number | null
          origin_address: string
          origin_city: string | null
          origin_city_id: string | null
          origin_geog: unknown
          origin_lat: number | null
          origin_lng: number | null
          origin_state: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          price_per_km: number | null
          problem_description: string | null
          producer_id: string
          prospect_user_id: string | null
          required_trucks: number
          route_geom: unknown
          route_waypoints: Json | null
          scheduled_date: string | null
          service_radius_km: number | null
          service_type: string | null
          show_contact_after_accept: boolean | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          tracking_ended_at: string | null
          tracking_required: boolean | null
          tracking_started_at: string | null
          tracking_status: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          vehicle_axles_required: number | null
          vehicle_type_required:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          visibility_filter: string | null
          weight: number
        }
        SetofOptions: {
          from: "*"
          to: "freights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_freight_status_text: {
        Args: { p_id: string; p_status_text: string }
        Returns: {
          accepted_by_company: boolean | null
          accepted_trucks: number
          allow_counter_proposals: boolean | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cargo_category_antt: string | null
          cargo_type: string
          commission_amount: number | null
          commission_rate: number | null
          company_id: string | null
          contact_phone: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          date_range_end: string | null
          date_range_start: string | null
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_city: string | null
          destination_city_id: string | null
          destination_geog: unknown
          destination_lat: number | null
          destination_lng: number | null
          destination_state: string | null
          distance_km: number | null
          driver_id: string | null
          drivers_assigned: string[] | null
          extra_fees: number | null
          extra_fees_description: string | null
          fiscal_documents_url: string | null
          flexible_dates: boolean | null
          guest_contact_document: string | null
          guest_contact_email: string | null
          guest_contact_name: string | null
          guest_contact_phone: string | null
          high_performance: boolean | null
          id: string
          is_full_booking: boolean | null
          is_guest_freight: boolean | null
          is_scheduled: boolean | null
          last_location_update: string | null
          metadata: Json | null
          minimum_antt_price: number | null
          origin_address: string
          origin_city: string | null
          origin_city_id: string | null
          origin_geog: unknown
          origin_lat: number | null
          origin_lng: number | null
          origin_state: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          price_per_km: number | null
          problem_description: string | null
          producer_id: string
          prospect_user_id: string | null
          required_trucks: number
          route_geom: unknown
          route_waypoints: Json | null
          scheduled_date: string | null
          service_radius_km: number | null
          service_type: string | null
          show_contact_after_accept: boolean | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          tracking_ended_at: string | null
          tracking_required: boolean | null
          tracking_started_at: string | null
          tracking_status: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          vehicle_axles_required: number | null
          vehicle_type_required:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          visibility_filter: string | null
          weight: number
        }
        SetofOptions: {
          from: "*"
          to: "freights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_payment_deadline_status: {
        Args: { p_freight_id: string }
        Returns: undefined
      }
      validate_password_strength: { Args: { password: string }; Returns: Json }
      validate_roles_post_migration: {
        Args: never
        Returns: {
          admin_in_user_roles_count: number
          invalid_profiles: Json
          invalid_profiles_count: number
          recommendations: string
          validation_status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "producer" | "service_provider"
      freight_service_type:
        | "FRETE_MOTO"
        | "CARGA"
        | "CARGA_GERAL"
        | "CARGA_AGRICOLA"
        | "CARGA_GRANEL"
        | "CARGA_LIQUIDA"
        | "GUINCHO"
        | "MUDANCA"
        | "TRANSPORTE_ANIMAIS"
        | "TRANSPORTE_MAQUINARIO"
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
        | "DELIVERED_PENDING_CONFIRMATION"
        | "COMPLETED"
      payment_method: "PIX" | "BOLETO" | "CARTAO" | "DIRETO"
      plan_type: "free" | "essential" | "professional"
      provider_service_type:
        | "AGRONOMO"
        | "ANALISE_SOLO"
        | "ASSISTENCIA_TECNICA"
        | "MECANICO"
        | "BORRACHEIRO"
        | "CHAVEIRO"
        | "AUTO_ELETRICA"
        | "COMBUSTIVEL"
        | "LIMPEZA_RURAL"
        | "PULVERIZACAO_DRONE"
        | "COLHEITA_TERCEIRIZADA"
        | "TOPOGRAFIA"
        | "ENERGIA_SOLAR"
        | "CONSULTORIA_RURAL"
        | "VETERINARIO"
        | "OUTROS"
      service_category:
        | "rodotrem"
        | "carreta"
        | "truck"
        | "vuc"
        | "pickup"
        | "prestador"
      subscription_status:
        | "active"
        | "canceled"
        | "past_due"
        | "unpaid"
        | "incomplete"
      urgency_level: "LOW" | "MEDIUM" | "HIGH"
      user_city_type:
        | "MOTORISTA_ORIGEM"
        | "MOTORISTA_DESTINO"
        | "PRESTADOR_SERVICO"
        | "PRODUTOR_LOCALIZACAO"
      user_role:
        | "PRODUTOR"
        | "MOTORISTA"
        | "PRESTADOR_SERVICOS"
        | "TRANSPORTADORA"
        | "MOTORISTA_AFILIADO"
      user_status: "PENDING" | "APPROVED" | "REJECTED"
      vehicle_type:
        | "TRUCK"
        | "BITREM"
        | "RODOTREM"
        | "CARRETA"
        | "VUC"
        | "TOCO"
        | "CARRETA_BAU"
        | "F400"
        | "STRADA"
        | "CARRO_PEQUENO"
        | "RODOTREM_7_EIXOS"
        | "RODOTREM_9_EIXOS"
        | "BITREM_7_EIXOS"
        | "BITREM_9_EIXOS"
        | "TRITREM_9_EIXOS"
        | "TRITREM_11_EIXOS"
        | "CAVALO_MECANICO_TOCO"
        | "CAVALO_MECANICO_TRUCK"
        | "CARRETA_SIDER"
        | "CARRETA_GRANELEIRA"
        | "CARRETA_PRANCHA"
        | "CARRETA_TANQUE"
        | "CARRETA_FRIGORIFICA"
        | "CARRETA_3_EIXOS"
        | "CARRETA_2_EIXOS"
        | "CAMINHAO_3_4"
        | "CAMINHAO_TRUCK"
        | "CAMINHONETE"
        | "VLC_URBANO"
        | "PICKUP"
        | "OUTROS"
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
      app_role: ["admin", "driver", "producer", "service_provider"],
      freight_service_type: [
        "FRETE_MOTO",
        "CARGA",
        "CARGA_GERAL",
        "CARGA_AGRICOLA",
        "CARGA_GRANEL",
        "CARGA_LIQUIDA",
        "GUINCHO",
        "MUDANCA",
        "TRANSPORTE_ANIMAIS",
        "TRANSPORTE_MAQUINARIO",
      ],
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
        "DELIVERED_PENDING_CONFIRMATION",
        "COMPLETED",
      ],
      payment_method: ["PIX", "BOLETO", "CARTAO", "DIRETO"],
      plan_type: ["free", "essential", "professional"],
      provider_service_type: [
        "AGRONOMO",
        "ANALISE_SOLO",
        "ASSISTENCIA_TECNICA",
        "MECANICO",
        "BORRACHEIRO",
        "CHAVEIRO",
        "AUTO_ELETRICA",
        "COMBUSTIVEL",
        "LIMPEZA_RURAL",
        "PULVERIZACAO_DRONE",
        "COLHEITA_TERCEIRIZADA",
        "TOPOGRAFIA",
        "ENERGIA_SOLAR",
        "CONSULTORIA_RURAL",
        "VETERINARIO",
        "OUTROS",
      ],
      service_category: [
        "rodotrem",
        "carreta",
        "truck",
        "vuc",
        "pickup",
        "prestador",
      ],
      subscription_status: [
        "active",
        "canceled",
        "past_due",
        "unpaid",
        "incomplete",
      ],
      urgency_level: ["LOW", "MEDIUM", "HIGH"],
      user_city_type: [
        "MOTORISTA_ORIGEM",
        "MOTORISTA_DESTINO",
        "PRESTADOR_SERVICO",
        "PRODUTOR_LOCALIZACAO",
      ],
      user_role: [
        "PRODUTOR",
        "MOTORISTA",
        "PRESTADOR_SERVICOS",
        "TRANSPORTADORA",
        "MOTORISTA_AFILIADO",
      ],
      user_status: ["PENDING", "APPROVED", "REJECTED"],
      vehicle_type: [
        "TRUCK",
        "BITREM",
        "RODOTREM",
        "CARRETA",
        "VUC",
        "TOCO",
        "CARRETA_BAU",
        "F400",
        "STRADA",
        "CARRO_PEQUENO",
        "RODOTREM_7_EIXOS",
        "RODOTREM_9_EIXOS",
        "BITREM_7_EIXOS",
        "BITREM_9_EIXOS",
        "TRITREM_9_EIXOS",
        "TRITREM_11_EIXOS",
        "CAVALO_MECANICO_TOCO",
        "CAVALO_MECANICO_TRUCK",
        "CARRETA_SIDER",
        "CARRETA_GRANELEIRA",
        "CARRETA_PRANCHA",
        "CARRETA_TANQUE",
        "CARRETA_FRIGORIFICA",
        "CARRETA_3_EIXOS",
        "CARRETA_2_EIXOS",
        "CAMINHAO_3_4",
        "CAMINHAO_TRUCK",
        "CAMINHONETE",
        "VLC_URBANO",
        "PICKUP",
        "OUTROS",
      ],
    },
  },
} as const
