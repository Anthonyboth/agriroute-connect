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
          {
            foreignKeyName: "access_denied_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          {
            foreignKeyName: "admin_password_reset_limits_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_registration_actions: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          internal_notes: string | null
          message_to_user: string | null
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          profile_id: string
          reason: string | null
          reason_category: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          message_to_user?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          profile_id: string
          reason?: string | null
          reason_category?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          message_to_user?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          profile_id?: string
          reason?: string | null
          reason_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_registration_actions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_registration_actions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_registration_actions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      admin_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "affiliated_drivers_tracking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
          {
            foreignKeyName: "affiliated_drivers_tracking_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      antifraud_feedback: {
        Row: {
          confirmed_fraud: boolean | null
          created_at: string | null
          event_id: string | null
          feedback_type: string | null
          freight_id: string | null
          id: string
          notes: string | null
          reviewer_id: string | null
          stop_event_id: string | null
        }
        Insert: {
          confirmed_fraud?: boolean | null
          created_at?: string | null
          event_id?: string | null
          feedback_type?: string | null
          freight_id?: string | null
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          stop_event_id?: string | null
        }
        Update: {
          confirmed_fraud?: boolean | null
          created_at?: string | null
          event_id?: string | null
          feedback_type?: string | null
          freight_id?: string | null
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          stop_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "antifraud_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "auditoria_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_feedback_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_feedback_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_feedback_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_feedback_stop_event_id_fkey"
            columns: ["stop_event_id"]
            isOneToOne: false
            referencedRelation: "stop_events"
            referencedColumns: ["id"]
          },
        ]
      }
      antifraud_nfe_events: {
        Row: {
          created_at: string
          details: Json
          device_fingerprint: string | null
          emission_id: string | null
          evidence: Json | null
          id: string
          ip_address: unknown
          issuer_id: string
          location_lat: number | null
          location_lng: number | null
          resolution_action: string | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          rule_code: string
          rule_id: string
          score_impact: number
          severity: string
          status: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          device_fingerprint?: string | null
          emission_id?: string | null
          evidence?: Json | null
          id?: string
          ip_address?: unknown
          issuer_id: string
          location_lat?: number | null
          location_lng?: number | null
          resolution_action?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code: string
          rule_id: string
          score_impact: number
          severity: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          device_fingerprint?: string | null
          emission_id?: string | null
          evidence?: Json | null
          id?: string
          ip_address?: unknown
          issuer_id?: string
          location_lat?: number | null
          location_lng?: number | null
          resolution_action?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code?: string
          rule_id?: string
          score_impact?: number
          severity?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "antifraud_nfe_events_emission_id_fkey"
            columns: ["emission_id"]
            isOneToOne: false
            referencedRelation: "nfe_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_nfe_events_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "fiscal_issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_nfe_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_nfe_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_nfe_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "antifraud_nfe_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      antifraud_nfe_rules: {
        Row: {
          auto_action: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          parameters: Json | null
          rule_code: string
          rule_name: string
          score_impact: number
          severity: string
          updated_at: string
        }
        Insert: {
          auto_action?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          parameters?: Json | null
          rule_code: string
          rule_name: string
          score_impact?: number
          severity: string
          updated_at?: string
        }
        Update: {
          auto_action?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          parameters?: Json | null
          rule_code?: string
          rule_name?: string
          score_impact?: number
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "antifraud_nfe_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antifraud_nfe_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      antt_freight_prices: {
        Row: {
          antt_resolution: string | null
          base_price: number
          created_at: string
          distance_range_max: number | null
          distance_range_min: number
          id: string
          last_sync_source: string | null
          price_per_km: number
          service_type: string
          updated_at: string
        }
        Insert: {
          antt_resolution?: string | null
          base_price?: number
          created_at?: string
          distance_range_max?: number | null
          distance_range_min: number
          id?: string
          last_sync_source?: string | null
          price_per_km: number
          service_type: string
          updated_at?: string
        }
        Update: {
          antt_resolution?: string | null
          base_price?: number
          created_at?: string
          distance_range_max?: number | null
          distance_range_min?: number
          id?: string
          last_sync_source?: string | null
          price_per_km?: number
          service_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      antt_price_sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          parsed_data: Json | null
          prices_updated: number | null
          raw_content: string | null
          source_url: string
          status: string
          synced_at: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          parsed_data?: Json | null
          prices_updated?: number | null
          raw_content?: string | null
          source_url: string
          status?: string
          synced_at?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          parsed_data?: Json | null
          prices_updated?: number | null
          raw_content?: string | null
          source_url?: string
          status?: string
          synced_at?: string
          triggered_by?: string | null
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
          {
            foreignKeyName: "antt_recalculation_history_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          block_reason: string | null
          blocked_until: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: unknown
          request_count: number
          user_id: string | null
          window_start: string
        }
        Insert: {
          block_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Update: {
          block_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: unknown
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
      auditoria_eventos: {
        Row: {
          codigo_regra: string
          created_at: string | null
          descricao: string
          empresa_id: string | null
          evidencias: Json | null
          frete_id: string | null
          id: string
          notas_resolucao: string | null
          resolvido: boolean | null
          resolvido_at: string | null
          resolvido_por: string | null
          severidade: string
          tipo: string
        }
        Insert: {
          codigo_regra: string
          created_at?: string | null
          descricao: string
          empresa_id?: string | null
          evidencias?: Json | null
          frete_id?: string | null
          id?: string
          notas_resolucao?: string | null
          resolvido?: boolean | null
          resolvido_at?: string | null
          resolvido_por?: string | null
          severidade: string
          tipo: string
        }
        Update: {
          codigo_regra?: string
          created_at?: string | null
          descricao?: string
          empresa_id?: string | null
          evidencias?: Json | null
          frete_id?: string | null
          id?: string
          notas_resolucao?: string | null
          resolvido?: boolean | null
          resolvido_at?: string | null
          resolvido_por?: string | null
          severidade?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_eventos_frete_id_fkey"
            columns: ["frete_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_eventos_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_eventos_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
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
      badge_types: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean | null
          name: string
          requirement_type: string
          requirement_value: number
          xp_reward: number
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          icon: string
          id: string
          is_active?: boolean | null
          name: string
          requirement_type: string
          requirement_value?: number
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          requirement_type?: string
          requirement_value?: number
          xp_reward?: number
        }
        Relationships: []
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
          {
            foreignKeyName: "balance_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "chat_typing_indicators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "chat_typing_indicators_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_typing_indicators_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_typing_indicators_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          zip_code: string | null
          zip_code_ranges: Json | null
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
          zip_code?: string | null
          zip_code_ranges?: Json | null
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
          zip_code?: string | null
          zip_code_ranges?: Json | null
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
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          message: string
          message_type: string | null
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
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message: string
          message_type?: string | null
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
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message?: string
          message_type?: string | null
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
            foreignKeyName: "company_driver_chats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "company_driver_chats_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "company_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "company_drivers_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_drivers_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_drivers_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "company_internal_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "company_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "company_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_invited_driver_id_fkey"
            columns: ["invited_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_invited_driver_id_fkey"
            columns: ["invited_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "company_vehicle_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "company_vehicle_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "company_vehicle_assignments_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "company_vehicle_assignments_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_audit_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string
          device_info: Json | null
          event_category: string
          event_data: Json
          event_type: string
          freight_id: string | null
          gps_location: Json | null
          id: string
          ip_address: unknown
          livestock_compliance_id: string | null
          new_state: Json | null
          previous_state: Json | null
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          device_info?: Json | null
          event_category: string
          event_data?: Json
          event_type: string
          freight_id?: string | null
          gps_location?: Json | null
          id?: string
          ip_address?: unknown
          livestock_compliance_id?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          device_info?: Json | null
          event_category?: string
          event_data?: Json
          event_type?: string
          freight_id?: string | null
          gps_location?: Json | null
          id?: string
          ip_address?: unknown
          livestock_compliance_id?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_audit_events_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_audit_events_livestock_compliance_id_fkey"
            columns: ["livestock_compliance_id"]
            isOneToOne: false
            referencedRelation: "livestock_freight_compliance"
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
            foreignKeyName: "convites_motoristas_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_motoristas_usado_por_fkey"
            columns: ["usado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_motoristas_usado_por_fkey"
            columns: ["usado_por"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      ctes: {
        Row: {
          ambiente: string | null
          authorized_at: string | null
          chave: string | null
          created_at: string | null
          dacte_url: string | null
          empresa_id: string | null
          frete_id: string | null
          id: string
          mensagem_erro: string | null
          modelo: string | null
          numero: string | null
          payload_envio: Json
          referencia: string
          resposta_sefaz: Json | null
          serie: string | null
          status: string | null
          tentativas: number | null
          updated_at: string | null
          xml_url: string | null
        }
        Insert: {
          ambiente?: string | null
          authorized_at?: string | null
          chave?: string | null
          created_at?: string | null
          dacte_url?: string | null
          empresa_id?: string | null
          frete_id?: string | null
          id?: string
          mensagem_erro?: string | null
          modelo?: string | null
          numero?: string | null
          payload_envio: Json
          referencia: string
          resposta_sefaz?: Json | null
          serie?: string | null
          status?: string | null
          tentativas?: number | null
          updated_at?: string | null
          xml_url?: string | null
        }
        Update: {
          ambiente?: string | null
          authorized_at?: string | null
          chave?: string | null
          created_at?: string | null
          dacte_url?: string | null
          empresa_id?: string | null
          frete_id?: string | null
          id?: string
          mensagem_erro?: string | null
          modelo?: string | null
          numero?: string | null
          payload_envio?: Json
          referencia?: string
          resposta_sefaz?: Json | null
          serie?: string | null
          status?: string | null
          tentativas?: number | null
          updated_at?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctes_frete_id_fkey"
            columns: ["frete_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_prices: {
        Row: {
          created_at: string | null
          effective_date: string
          id: string
          price: number
          source: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string
          id?: string
          price: number
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          id?: string
          price?: number
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "document_request_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "document_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "document_requests_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          zip_code: string | null
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
          zip_code?: string | null
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
          zip_code?: string | null
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
      driver_badges: {
        Row: {
          badge_type_id: string
          driver_id: string
          earned_at: string
          id: string
          metadata: Json | null
        }
        Insert: {
          badge_type_id: string
          driver_id: string
          earned_at?: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          badge_type_id?: string
          driver_id?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_badges_badge_type_id_fkey"
            columns: ["badge_type_id"]
            isOneToOne: false
            referencedRelation: "badge_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_badges_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_badges_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
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
            foreignKeyName: "driver_checkins_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      driver_current_locations: {
        Row: {
          driver_profile_id: string
          last_gps_update: string | null
          lat: number | null
          lng: number | null
          updated_at: string
        }
        Insert: {
          driver_profile_id: string
          last_gps_update?: string | null
          lat?: number | null
          lng?: number | null
          updated_at?: string
        }
        Update: {
          driver_profile_id?: string
          last_gps_update?: string | null
          lat?: number | null
          lng?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_expenses: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          driver_id: string
          expense_date: string
          expense_type: string
          freight_id: string | null
          id: string
          km_reading: number | null
          liters: number | null
          price_per_liter: number | null
          receipt_url: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          driver_id: string
          expense_date?: string
          expense_type: string
          freight_id?: string | null
          id?: string
          km_reading?: number | null
          liters?: number | null
          price_per_liter?: number | null
          receipt_url?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          driver_id?: string
          expense_date?: string
          expense_type?: string
          freight_id?: string | null
          id?: string
          km_reading?: number | null
          liters?: number | null
          price_per_liter?: number | null
          receipt_url?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_expenses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_expenses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_expenses_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_levels: {
        Row: {
          created_at: string
          current_xp: number
          driver_id: string
          id: string
          level: number
          total_xp: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_xp?: number
          driver_id: string
          id?: string
          level?: number
          total_xp?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_xp?: number
          driver_id?: string
          id?: string
          level?: number
          total_xp?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_levels_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_levels_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_location_history: {
        Row: {
          accuracy: number | null
          captured_at: string
          created_at: string
          driver_profile_id: string
          expires_at: string
          freight_id: string | null
          heading: number | null
          id: string
          lat: number
          lng: number
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          captured_at?: string
          created_at?: string
          driver_profile_id: string
          expires_at?: string
          freight_id?: string | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          created_at?: string
          driver_profile_id?: string
          expires_at?: string
          freight_id?: string | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_location_history_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_location_history_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_location_history_freight_id_fkey"
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
            foreignKeyName: "driver_payout_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payout_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payout_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      driver_rewards: {
        Row: {
          driver_id: string
          expires_at: string | null
          id: string
          redeemed_at: string
          reward_id: string
          status: string
        }
        Insert: {
          driver_id: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string
          reward_id: string
          status?: string
        }
        Update: {
          driver_id?: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string
          reward_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_rewards_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rewards_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
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
          zip_code: string | null
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
          zip_code?: string | null
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
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_driver_service_areas_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_driver_service_areas_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      driver_trip_progress: {
        Row: {
          accepted_at: string | null
          assignment_id: string | null
          created_at: string
          current_status: string
          delivered_at: string | null
          driver_id: string
          driver_notes: string | null
          freight_id: string
          id: string
          in_transit_at: string | null
          last_lat: number | null
          last_lng: number | null
          loaded_at: string | null
          loading_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assignment_id?: string | null
          created_at?: string
          current_status?: string
          delivered_at?: string | null
          driver_id: string
          driver_notes?: string | null
          freight_id: string
          id?: string
          in_transit_at?: string | null
          last_lat?: number | null
          last_lng?: number | null
          loaded_at?: string | null
          loading_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assignment_id?: string | null
          created_at?: string
          current_status?: string
          delivered_at?: string | null
          driver_id?: string
          driver_notes?: string | null
          freight_id?: string
          id?: string
          in_transit_at?: string | null
          last_lat?: number | null
          last_lng?: number | null
          loaded_at?: string | null
          loading_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_trip_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "freight_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_trip_progress_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_trip_progress_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_trip_progress_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
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
      edge_function_health: {
        Row: {
          avg_latency_ms: number | null
          created_at: string | null
          error_count: number | null
          function_name: string
          id: string
          last_check: string | null
          last_error: string | null
          last_success: string | null
          metadata: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          avg_latency_ms?: number | null
          created_at?: string | null
          error_count?: number | null
          function_name: string
          id?: string
          last_check?: string | null
          last_error?: string | null
          last_success?: string | null
          metadata?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          avg_latency_ms?: number | null
          created_at?: string | null
          error_count?: number | null
          function_name?: string
          id?: string
          last_check?: string | null
          last_error?: string | null
          last_success?: string | null
          metadata?: Json | null
          status?: string
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
            foreignKeyName: "emergency_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      emission_packages: {
        Row: {
          available_from: string | null
          available_until: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_percentage: number | null
          display_order: number | null
          emissions_count: number
          id: string
          is_active: boolean
          is_featured: boolean | null
          name: string
          price_per_emission: number
          total_price: number
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          emissions_count: number
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          name: string
          price_per_emission: number
          total_price: number
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          emissions_count?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          name?: string
          price_per_emission?: number
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emission_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emission_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      emission_queue: {
        Row: {
          attempts: number
          created_at: string
          emission_id: string
          error_history: Json | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_attempt_at: string | null
          priority: number | null
          queue_status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          emission_id: string
          error_history?: Json | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          priority?: number | null
          queue_status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          emission_id?: string
          error_history?: Json | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          priority?: number | null
          queue_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emission_queue_emission_id_fkey"
            columns: ["emission_id"]
            isOneToOne: true
            referencedRelation: "nfe_emissions"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_fiscais: {
        Row: {
          ambiente_fiscal: string | null
          ativo: boolean | null
          cnpj: string
          created_at: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          id: string
          inscricao_estadual: string | null
          municipio: string
          municipio_ibge: string
          nome_fantasia: string | null
          onboarding_completo: boolean | null
          razao_social: string
          rntrc: string | null
          transport_company_id: string | null
          uf: string
          updated_at: string | null
        }
        Insert: {
          ambiente_fiscal?: string | null
          ativo?: boolean | null
          cnpj: string
          created_at?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          id?: string
          inscricao_estadual?: string | null
          municipio: string
          municipio_ibge: string
          nome_fantasia?: string | null
          onboarding_completo?: boolean | null
          razao_social: string
          rntrc?: string | null
          transport_company_id?: string | null
          uf: string
          updated_at?: string | null
        }
        Update: {
          ambiente_fiscal?: string | null
          ativo?: boolean | null
          cnpj?: string
          created_at?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          id?: string
          inscricao_estadual?: string | null
          municipio?: string
          municipio_ibge?: string
          nome_fantasia?: string | null
          onboarding_completo?: boolean | null
          razao_social?: string
          rntrc?: string | null
          transport_company_id?: string | null
          uf?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_fiscais_transport_company_id_fkey"
            columns: ["transport_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_fiscais_transport_company_id_fkey"
            columns: ["transport_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_data_access_log: {
        Row: {
          access_type: string
          accessed_profile_id: string | null
          accessor_user_id: string
          created_at: string
          id: string
          ip_address: unknown
          success: boolean | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_profile_id?: string | null
          accessor_user_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_profile_id?: string | null
          accessor_user_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      encryption_keys: {
        Row: {
          created_at: string | null
          id: string
          key_value: string
          rotated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          key_value: string
          rotated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key_value?: string
          rotated_at?: string | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "external_payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payments_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payments_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payments_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
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
      financial_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string
          freight_id: string | null
          id: string
          metadata: Json | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          description: string
          freight_id?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string
          freight_id?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_certificates: {
        Row: {
          certificate_type: string
          created_at: string
          encryption_key_id: string | null
          id: string
          is_expired: boolean | null
          is_valid: boolean | null
          issuer_cn: string | null
          issuer_id: string
          last_used_at: string | null
          password_hash: string | null
          purchase_amount: number | null
          purchase_date: string | null
          purchase_order_id: string | null
          purchase_provider: string | null
          purchased_via_platform: boolean | null
          serial_number: string | null
          status: string
          storage_path: string | null
          subject_cn: string | null
          subject_document: string | null
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
          usage_count: number | null
          valid_from: string | null
          valid_until: string | null
          validation_error: string | null
        }
        Insert: {
          certificate_type?: string
          created_at?: string
          encryption_key_id?: string | null
          id?: string
          is_expired?: boolean | null
          is_valid?: boolean | null
          issuer_cn?: string | null
          issuer_id: string
          last_used_at?: string | null
          password_hash?: string | null
          purchase_amount?: number | null
          purchase_date?: string | null
          purchase_order_id?: string | null
          purchase_provider?: string | null
          purchased_via_platform?: boolean | null
          serial_number?: string | null
          status?: string
          storage_path?: string | null
          subject_cn?: string | null
          subject_document?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
          validation_error?: string | null
        }
        Update: {
          certificate_type?: string
          created_at?: string
          encryption_key_id?: string | null
          id?: string
          is_expired?: boolean | null
          is_valid?: boolean | null
          issuer_cn?: string | null
          issuer_id?: string
          last_used_at?: string | null
          password_hash?: string | null
          purchase_amount?: number | null
          purchase_date?: string | null
          purchase_order_id?: string | null
          purchase_provider?: string | null
          purchased_via_platform?: boolean | null
          serial_number?: string | null
          status?: string
          storage_path?: string | null
          subject_cn?: string | null
          subject_document?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
          validation_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_certificates_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "fiscal_issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_compliance_logs: {
        Row: {
          action_type: string
          created_at: string | null
          freight_id: string | null
          id: string
          metadata: Json | null
          nfe_access_key: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          freight_id?: string | null
          id?: string
          metadata?: Json | null
          nfe_access_key?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          freight_id?: string | null
          id?: string
          metadata?: Json | null
          nfe_access_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_compliance_logs_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_issuers: {
        Row: {
          activated_at: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          address_zip_code: string | null
          block_reason: string | null
          blocked_at: string | null
          blocked_by: string | null
          city: string
          city_ibge_code: string | null
          cnae_code: string | null
          cnae_description: string | null
          created_at: string
          document_number: string
          document_type: string
          fiscal_environment: string
          focus_company_id: string | null
          id: string
          legal_name: string
          municipal_registration: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          profile_id: string
          sefaz_status: string | null
          sefaz_validated_at: string | null
          sefaz_validation_response: Json | null
          state_registration: string | null
          status: string
          status_reason: string | null
          tax_regime: string
          trade_name: string | null
          uf: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          city: string
          city_ibge_code?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          created_at?: string
          document_number: string
          document_type: string
          fiscal_environment?: string
          focus_company_id?: string | null
          id?: string
          legal_name: string
          municipal_registration?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          profile_id: string
          sefaz_status?: string | null
          sefaz_validated_at?: string | null
          sefaz_validation_response?: Json | null
          state_registration?: string | null
          status?: string
          status_reason?: string | null
          tax_regime: string
          trade_name?: string | null
          uf: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          city?: string
          city_ibge_code?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          created_at?: string
          document_number?: string
          document_type?: string
          fiscal_environment?: string
          focus_company_id?: string | null
          id?: string
          legal_name?: string
          municipal_registration?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          profile_id?: string
          sefaz_status?: string | null
          sefaz_validated_at?: string | null
          sefaz_validation_response?: Json | null
          state_registration?: string | null
          status?: string
          status_reason?: string | null
          tax_regime?: string
          trade_name?: string | null
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_issuers_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_issuers_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_issuers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_issuers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_responsibility_acceptances: {
        Row: {
          accepted_at: string | null
          id: string
          ip_address: unknown
          term_version: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          ip_address?: unknown
          term_version?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          id?: string
          ip_address?: unknown
          term_version?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fiscal_terms_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          device_fingerprint: string | null
          id: string
          ip_address: unknown
          issuer_id: string | null
          location_lat: number | null
          location_lng: number | null
          profile_id: string
          term_hash: string
          term_type: string
          term_version: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          issuer_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          profile_id: string
          term_hash: string
          term_type: string
          term_version: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          issuer_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          profile_id?: string
          term_hash?: string
          term_type?: string
          term_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_terms_acceptances_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "fiscal_issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_terms_acceptances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_terms_acceptances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_wallet: {
        Row: {
          available_balance: number
          created_at: string
          emissions_count: number
          id: string
          issuer_id: string | null
          last_credit_at: string | null
          last_emission_at: string | null
          profile_id: string
          reserved_balance: number
          total_credited: number
          total_debited: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          emissions_count?: number
          id?: string
          issuer_id?: string | null
          last_credit_at?: string | null
          last_emission_at?: string | null
          profile_id: string
          reserved_balance?: number
          total_credited?: number
          total_debited?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          emissions_count?: number
          id?: string
          issuer_id?: string | null
          last_credit_at?: string | null
          last_emission_at?: string | null
          profile_id?: string
          reserved_balance?: number
          total_credited?: number
          total_debited?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_wallet_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "fiscal_issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_wallet_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_wallet_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          reference_id: string | null
          reference_type: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_wallet_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_wallet_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "fiscal_wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscalizacao_logs: {
        Row: {
          created_at: string | null
          freight_id: string | null
          id: string
          ip_address: unknown
          placa: string
          response_data: Json | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          freight_id?: string | null
          id?: string
          ip_address?: unknown
          placa: string
          response_data?: Json | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          freight_id?: string | null
          id?: string
          ip_address?: unknown
          placa?: string
          response_data?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscalizacao_logs_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
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
      freight_agreed_prices: {
        Row: {
          agreed_at: string
          agreed_by_role: string
          agreed_by_user_id: string
          agreed_location_accuracy_m: number | null
          agreed_location_error: string | null
          agreed_location_lat: number | null
          agreed_location_lng: number | null
          agreed_location_source: string
          agreed_pricing_type: string
          agreed_unit_rate: number
          created_at: string
          freight_id: string
          id: string
          metadata: Json | null
        }
        Insert: {
          agreed_at?: string
          agreed_by_role: string
          agreed_by_user_id: string
          agreed_location_accuracy_m?: number | null
          agreed_location_error?: string | null
          agreed_location_lat?: number | null
          agreed_location_lng?: number | null
          agreed_location_source?: string
          agreed_pricing_type: string
          agreed_unit_rate: number
          created_at?: string
          freight_id: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          agreed_at?: string
          agreed_by_role?: string
          agreed_by_user_id?: string
          agreed_location_accuracy_m?: number | null
          agreed_location_error?: string | null
          agreed_location_lat?: number | null
          agreed_location_lng?: number | null
          agreed_location_source?: string
          agreed_pricing_type?: string
          agreed_unit_rate?: number
          created_at?: string
          freight_id?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_agreed_prices_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          freight_id: string
          id: string
          message: string | null
          new_value: Json | null
          previous_value: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          freight_id: string
          id?: string
          message?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          freight_id?: string
          id?: string
          message?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_alerts_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_assignment_history: {
        Row: {
          agreed_price: number
          assignment_id: string
          cargo_type: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          delivery_confirmed_at: string | null
          destination_city: string | null
          destination_state: string | null
          distance_km: number | null
          driver_id: string
          freight_id: string
          id: string
          origin_city: string | null
          origin_state: string | null
          payment_confirmed_by_driver_at: string | null
          payment_confirmed_by_producer_at: string | null
          status_final: string
          trip_snapshot: Json | null
          weight_per_truck: number | null
        }
        Insert: {
          agreed_price?: number
          assignment_id: string
          cargo_type?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_confirmed_at?: string | null
          destination_city?: string | null
          destination_state?: string | null
          distance_km?: number | null
          driver_id: string
          freight_id: string
          id?: string
          origin_city?: string | null
          origin_state?: string | null
          payment_confirmed_by_driver_at?: string | null
          payment_confirmed_by_producer_at?: string | null
          status_final: string
          trip_snapshot?: Json | null
          weight_per_truck?: number | null
        }
        Update: {
          agreed_price?: number
          assignment_id?: string
          cargo_type?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_confirmed_at?: string | null
          destination_city?: string | null
          destination_state?: string | null
          distance_km?: number | null
          driver_id?: string
          freight_id?: string
          id?: string
          origin_city?: string | null
          origin_state?: string | null
          payment_confirmed_by_driver_at?: string | null
          payment_confirmed_by_producer_at?: string | null
          status_final?: string
          trip_snapshot?: Json | null
          weight_per_truck?: number | null
        }
        Relationships: []
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
            foreignKeyName: "freight_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "freight_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          {
            foreignKeyName: "freight_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_secure"
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
          {
            foreignKeyName: "freight_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          {
            foreignKeyName: "freight_chat_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "freight_checkins_counterpart_confirmed_by_fkey"
            columns: ["counterpart_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          {
            foreignKeyName: "freight_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_delay_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          detected_at: string | null
          freight_id: string
          id: string
          location_lat: number | null
          location_lng: number | null
          message: string
          metadata: Json | null
          notified_at: string | null
          notified_producer: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          detected_at?: string | null
          freight_id: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          message: string
          metadata?: Json | null
          notified_at?: string | null
          notified_producer?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          detected_at?: string | null
          freight_id?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          message?: string
          metadata?: Json | null
          notified_at?: string | null
          notified_producer?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_delay_alerts_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_delay_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_delay_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_eta_history: {
        Row: {
          avg_speed_kmh: number | null
          calculated_at: string | null
          eta_minutes: number | null
          freight_id: string
          id: string
          remaining_distance_km: number | null
          source: string | null
        }
        Insert: {
          avg_speed_kmh?: number | null
          calculated_at?: string | null
          eta_minutes?: number | null
          freight_id: string
          id?: string
          remaining_distance_km?: number | null
          source?: string | null
        }
        Update: {
          avg_speed_kmh?: number | null
          calculated_at?: string | null
          eta_minutes?: number | null
          freight_id?: string
          id?: string
          remaining_distance_km?: number | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_eta_history_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_events: {
        Row: {
          created_at: string | null
          driver_profile_id: string | null
          event_type: string
          freight_id: string
          id: string
          lat: number | null
          lng: number | null
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          driver_profile_id?: string | null
          event_type: string
          freight_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          driver_profile_id?: string | null
          event_type?: string
          freight_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_events_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_events_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_events_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_feedback: {
        Row: {
          alert_id: string | null
          comment: string | null
          created_at: string | null
          freight_id: string
          id: string
          label: string
          reviewer_id: string | null
          reviewer_role: string | null
          stop_id: string | null
        }
        Insert: {
          alert_id?: string | null
          comment?: string | null
          created_at?: string | null
          freight_id: string
          id?: string
          label: string
          reviewer_id?: string | null
          reviewer_role?: string | null
          stop_id?: string | null
        }
        Update: {
          alert_id?: string | null
          comment?: string | null
          created_at?: string | null
          freight_id?: string
          id?: string
          label?: string
          reviewer_id?: string | null
          reviewer_role?: string | null
          stop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_feedback_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "freight_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_feedback_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_feedback_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_feedback_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_feedback_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "freight_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_history: {
        Row: {
          accepted_trucks: number
          cancelled_at: string | null
          cargo_type: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          destination_city: string | null
          destination_state: string | null
          distance_km: number | null
          driver_id: string | null
          freight_id: string
          id: string
          is_guest_freight: boolean
          origin_city: string | null
          origin_state: string | null
          payment_confirmed_by_driver_at: string | null
          payment_confirmed_by_producer_at: string | null
          price_per_truck: number
          price_total: number
          producer_id: string | null
          required_trucks: number
          source: string
          status_final: string
          trip_snapshot: Json | null
          weight: number | null
        }
        Insert: {
          accepted_trucks?: number
          cancelled_at?: string | null
          cargo_type?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          destination_city?: string | null
          destination_state?: string | null
          distance_km?: number | null
          driver_id?: string | null
          freight_id: string
          id?: string
          is_guest_freight?: boolean
          origin_city?: string | null
          origin_state?: string | null
          payment_confirmed_by_driver_at?: string | null
          payment_confirmed_by_producer_at?: string | null
          price_per_truck?: number
          price_total?: number
          producer_id?: string | null
          required_trucks?: number
          source?: string
          status_final: string
          trip_snapshot?: Json | null
          weight?: number | null
        }
        Update: {
          accepted_trucks?: number
          cancelled_at?: string | null
          cargo_type?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          destination_city?: string | null
          destination_state?: string | null
          distance_km?: number | null
          driver_id?: string | null
          freight_id?: string
          id?: string
          is_guest_freight?: boolean
          origin_city?: string | null
          origin_state?: string | null
          payment_confirmed_by_driver_at?: string | null
          payment_confirmed_by_producer_at?: string | null
          price_per_truck?: number
          price_total?: number
          producer_id?: string | null
          required_trucks?: number
          source?: string
          status_final?: string
          trip_snapshot?: Json | null
          weight?: number | null
        }
        Relationships: []
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
          file_name: string | null
          file_size: number | null
          file_url: string | null
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
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
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
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
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
            foreignKeyName: "freight_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "freight_messages_target_driver_id_fkey"
            columns: ["target_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_messages_target_vehicle_id_fkey"
            columns: ["target_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_messages_target_vehicle_id_fkey"
            columns: ["target_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_secure"
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
      freight_price_agreements: {
        Row: {
          agreed_at: string
          agreed_by_driver_id: string | null
          agreed_by_requester_id: string | null
          agreed_pricing_type: string
          agreed_total: number | null
          agreed_unit_rate: number
          created_at: string
          currency: string
          driver_location_accuracy_m: number | null
          driver_location_lat: number | null
          driver_location_lng: number | null
          driver_location_source: string | null
          driver_role: string | null
          freight_id: string
          id: string
          metadata: Json | null
          requester_location_accuracy_m: number | null
          requester_location_lat: number | null
          requester_location_lng: number | null
          requester_location_source: string | null
          requester_role: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          agreed_at?: string
          agreed_by_driver_id?: string | null
          agreed_by_requester_id?: string | null
          agreed_pricing_type: string
          agreed_total?: number | null
          agreed_unit_rate: number
          created_at?: string
          currency?: string
          driver_location_accuracy_m?: number | null
          driver_location_lat?: number | null
          driver_location_lng?: number | null
          driver_location_source?: string | null
          driver_role?: string | null
          freight_id: string
          id?: string
          metadata?: Json | null
          requester_location_accuracy_m?: number | null
          requester_location_lat?: number | null
          requester_location_lng?: number | null
          requester_location_source?: string | null
          requester_role?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          agreed_at?: string
          agreed_by_driver_id?: string | null
          agreed_by_requester_id?: string | null
          agreed_pricing_type?: string
          agreed_total?: number | null
          agreed_unit_rate?: number
          created_at?: string
          currency?: string
          driver_location_accuracy_m?: number | null
          driver_location_lat?: number | null
          driver_location_lng?: number | null
          driver_location_source?: string | null
          driver_role?: string | null
          freight_id?: string
          id?: string
          metadata?: Json | null
          requester_location_accuracy_m?: number | null
          requester_location_lat?: number | null
          requester_location_lng?: number | null
          requester_location_source?: string | null
          requester_role?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "freight_price_agreements_agreed_by_driver_id_fkey"
            columns: ["agreed_by_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_price_agreements_agreed_by_driver_id_fkey"
            columns: ["agreed_by_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_price_agreements_agreed_by_requester_id_fkey"
            columns: ["agreed_by_requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_price_agreements_agreed_by_requester_id_fkey"
            columns: ["agreed_by_requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_price_agreements_freight_id_fkey"
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
          proposal_pricing_type: string | null
          proposal_unit_price: number | null
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
          proposal_pricing_type?: string | null
          proposal_unit_price?: number | null
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
          proposal_pricing_type?: string | null
          proposal_unit_price?: number | null
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
            foreignKeyName: "freight_proposals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          assignment_id: string | null
          comment: string | null
          company_id: string | null
          created_at: string
          freight_id: string
          id: string
          rated_user_id: string
          rater_id: string
          rating: number
          rating_type: string
        }
        Insert: {
          assignment_id?: string | null
          comment?: string | null
          company_id?: string | null
          created_at?: string
          freight_id: string
          id?: string
          rated_user_id: string
          rater_id: string
          rating: number
          rating_type: string
        }
        Update: {
          assignment_id?: string | null
          comment?: string | null
          company_id?: string | null
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
            foreignKeyName: "fk_freight_ratings_rated"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_freight_ratings_rater"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_freight_ratings_rater"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_ratings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "freight_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_ratings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_ratings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_route_history: {
        Row: {
          accuracy: number | null
          altitude: number | null
          captured_at: string
          created_at: string | null
          distance_from_start_km: number | null
          distance_to_destination_km: number | null
          driver_profile_id: string
          freight_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          segment_index: number | null
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          captured_at?: string
          created_at?: string | null
          distance_from_start_km?: number | null
          distance_to_destination_km?: number | null
          driver_profile_id: string
          freight_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          segment_index?: number | null
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          captured_at?: string
          created_at?: string | null
          distance_from_start_km?: number | null
          distance_to_destination_km?: number | null
          driver_profile_id?: string
          freight_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          segment_index?: number | null
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_route_history_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_route_history_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_route_history_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_sanitary_documents: {
        Row: {
          animal_count: number | null
          created_at: string | null
          created_by: string | null
          destination_property: string | null
          document_number: string | null
          document_type: string
          expiry_date: string | null
          file_url: string | null
          freight_id: string
          id: string
          issue_date: string | null
          issuing_agency: string | null
          notes: string | null
          ocr_confidence: number | null
          ocr_extracted_data: Json | null
          origin_property: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_status: string | null
        }
        Insert: {
          animal_count?: number | null
          created_at?: string | null
          created_by?: string | null
          destination_property?: string | null
          document_number?: string | null
          document_type: string
          expiry_date?: string | null
          file_url?: string | null
          freight_id: string
          id?: string
          issue_date?: string | null
          issuing_agency?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_extracted_data?: Json | null
          origin_property?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
        }
        Update: {
          animal_count?: number | null
          created_at?: string | null
          created_by?: string | null
          destination_property?: string | null
          document_number?: string | null
          document_type?: string
          expiry_date?: string | null
          file_url?: string | null
          freight_id?: string
          id?: string
          issue_date?: string | null
          issuing_agency?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_extracted_data?: Json | null
          origin_property?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_sanitary_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_sanitary_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_sanitary_documents_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_sanitary_documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_sanitary_documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "freight_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      freight_stops: {
        Row: {
          address: string | null
          authorization_reason: string | null
          classified_as: string | null
          created_at: string | null
          driver_profile_id: string | null
          duration_minutes: number | null
          ended_at: string | null
          freight_id: string
          id: string
          is_authorized: boolean | null
          lat: number
          lng: number
          risk_score: number | null
          started_at: string | null
        }
        Insert: {
          address?: string | null
          authorization_reason?: string | null
          classified_as?: string | null
          created_at?: string | null
          driver_profile_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          freight_id: string
          id?: string
          is_authorized?: boolean | null
          lat: number
          lng: number
          risk_score?: number | null
          started_at?: string | null
        }
        Update: {
          address?: string | null
          authorization_reason?: string | null
          classified_as?: string | null
          created_at?: string | null
          driver_profile_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          freight_id?: string
          id?: string
          is_authorized?: boolean | null
          lat?: number
          lng?: number
          risk_score?: number | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_stops_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_stops_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_stops_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_templates: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          payload: Json
          producer_id: string
          shared_with_company: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          payload: Json
          producer_id: string
          shared_with_company?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          producer_id?: string
          shared_with_company?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_templates_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_templates_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      freights: {
        Row: {
          accepted_by_company: boolean | null
          accepted_trucks: number
          allow_counter_proposals: boolean | null
          antifraud_analyzed_at: string | null
          antifraud_level: string | null
          antifraud_score: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cargo_category: string | null
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
          delay_alert_status: string | null
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_city: string | null
          destination_city_id: string | null
          destination_complement: string | null
          destination_geog: unknown
          destination_lat: number | null
          destination_lng: number | null
          destination_neighborhood: string | null
          destination_number: string | null
          destination_state: string | null
          destination_street: string | null
          destination_zip_code: string | null
          distance_km: number | null
          distance_source: string | null
          distancia_km_manual: number | null
          driver_id: string | null
          drivers_assigned: string[] | null
          estimated_arrival_at: string | null
          eta_average_speed_kmh: number | null
          eta_calculated_at: string | null
          eta_remaining_distance_km: number | null
          expires_at: string | null
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
          last_eta_minutes: number | null
          last_location_update: string | null
          metadata: Json | null
          min_driver_rating: number | null
          minimum_antt_price: number | null
          offline_minutes: number | null
          origin_address: string
          origin_city: string | null
          origin_city_id: string | null
          origin_complement: string | null
          origin_geog: unknown
          origin_lat: number | null
          origin_lng: number | null
          origin_neighborhood: string | null
          origin_number: string | null
          origin_state: string | null
          origin_street: string | null
          origin_zip_code: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          price_per_km: number | null
          pricing_type: string
          problem_description: string | null
          producer_id: string | null
          prospect_user_id: string | null
          reference_number: number | null
          region_code: string | null
          required_trucks: number
          requires_sanitary_docs: boolean | null
          risk_score: number | null
          route_deviation_max_km: number | null
          route_geom: unknown
          route_waypoints: Json | null
          sanitary_compliance_status: string | null
          scheduled_date: string | null
          service_radius_km: number | null
          service_type: string | null
          show_contact_after_accept: boolean | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          total_distance_km: number | null
          total_duration_minutes: number | null
          total_offline_time_minutes: number | null
          total_stop_minutes: number | null
          total_stop_time_minutes: number | null
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
          visibility_type: string | null
          weight: number
        }
        Insert: {
          accepted_by_company?: boolean | null
          accepted_trucks?: number
          allow_counter_proposals?: boolean | null
          antifraud_analyzed_at?: string | null
          antifraud_level?: string | null
          antifraud_score?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cargo_category?: string | null
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
          delay_alert_status?: string | null
          delivery_date: string
          delivery_observations?: string | null
          description?: string | null
          destination_address: string
          destination_city?: string | null
          destination_city_id?: string | null
          destination_complement?: string | null
          destination_geog?: unknown
          destination_lat?: number | null
          destination_lng?: number | null
          destination_neighborhood?: string | null
          destination_number?: string | null
          destination_state?: string | null
          destination_street?: string | null
          destination_zip_code?: string | null
          distance_km?: number | null
          distance_source?: string | null
          distancia_km_manual?: number | null
          driver_id?: string | null
          drivers_assigned?: string[] | null
          estimated_arrival_at?: string | null
          eta_average_speed_kmh?: number | null
          eta_calculated_at?: string | null
          eta_remaining_distance_km?: number | null
          expires_at?: string | null
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
          last_eta_minutes?: number | null
          last_location_update?: string | null
          metadata?: Json | null
          min_driver_rating?: number | null
          minimum_antt_price?: number | null
          offline_minutes?: number | null
          origin_address: string
          origin_city?: string | null
          origin_city_id?: string | null
          origin_complement?: string | null
          origin_geog?: unknown
          origin_lat?: number | null
          origin_lng?: number | null
          origin_neighborhood?: string | null
          origin_number?: string | null
          origin_state?: string | null
          origin_street?: string | null
          origin_zip_code?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations?: string | null
          price: number
          price_per_km?: number | null
          pricing_type?: string
          problem_description?: string | null
          producer_id?: string | null
          prospect_user_id?: string | null
          reference_number?: number | null
          region_code?: string | null
          required_trucks?: number
          requires_sanitary_docs?: boolean | null
          risk_score?: number | null
          route_deviation_max_km?: number | null
          route_geom?: unknown
          route_waypoints?: Json | null
          sanitary_compliance_status?: string | null
          scheduled_date?: string | null
          service_radius_km?: number | null
          service_type?: string | null
          show_contact_after_accept?: boolean | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          total_distance_km?: number | null
          total_duration_minutes?: number | null
          total_offline_time_minutes?: number | null
          total_stop_minutes?: number | null
          total_stop_time_minutes?: number | null
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
          visibility_type?: string | null
          weight: number
        }
        Update: {
          accepted_by_company?: boolean | null
          accepted_trucks?: number
          allow_counter_proposals?: boolean | null
          antifraud_analyzed_at?: string | null
          antifraud_level?: string | null
          antifraud_score?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cargo_category?: string | null
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
          delay_alert_status?: string | null
          delivery_date?: string
          delivery_observations?: string | null
          description?: string | null
          destination_address?: string
          destination_city?: string | null
          destination_city_id?: string | null
          destination_complement?: string | null
          destination_geog?: unknown
          destination_lat?: number | null
          destination_lng?: number | null
          destination_neighborhood?: string | null
          destination_number?: string | null
          destination_state?: string | null
          destination_street?: string | null
          destination_zip_code?: string | null
          distance_km?: number | null
          distance_source?: string | null
          distancia_km_manual?: number | null
          driver_id?: string | null
          drivers_assigned?: string[] | null
          estimated_arrival_at?: string | null
          eta_average_speed_kmh?: number | null
          eta_calculated_at?: string | null
          eta_remaining_distance_km?: number | null
          expires_at?: string | null
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
          last_eta_minutes?: number | null
          last_location_update?: string | null
          metadata?: Json | null
          min_driver_rating?: number | null
          minimum_antt_price?: number | null
          offline_minutes?: number | null
          origin_address?: string
          origin_city?: string | null
          origin_city_id?: string | null
          origin_complement?: string | null
          origin_geog?: unknown
          origin_lat?: number | null
          origin_lng?: number | null
          origin_neighborhood?: string | null
          origin_number?: string | null
          origin_state?: string | null
          origin_street?: string | null
          origin_zip_code?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date?: string
          pickup_observations?: string | null
          price?: number
          price_per_km?: number | null
          pricing_type?: string
          problem_description?: string | null
          producer_id?: string | null
          prospect_user_id?: string | null
          reference_number?: number | null
          region_code?: string | null
          required_trucks?: number
          requires_sanitary_docs?: boolean | null
          risk_score?: number | null
          route_deviation_max_km?: number | null
          route_geom?: unknown
          route_waypoints?: Json | null
          sanitary_compliance_status?: string | null
          scheduled_date?: string | null
          service_radius_km?: number | null
          service_type?: string | null
          show_contact_after_accept?: boolean | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          total_distance_km?: number | null
          total_duration_minutes?: number | null
          total_offline_time_minutes?: number | null
          total_stop_minutes?: number | null
          total_stop_time_minutes?: number | null
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
          visibility_type?: string | null
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
            foreignKeyName: "freights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
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
            foreignKeyName: "freights_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "freights_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      gta_assisted_drafts: {
        Row: {
          additional_data: Json | null
          animal_category: string | null
          animal_count: number
          animal_species: string
          created_at: string
          destination_property_data: Json | null
          destination_uf: string
          freight_id: string | null
          gta_uploaded_at: string | null
          id: string
          origin_property_data: Json | null
          origin_uf: string
          portal_url_used: string | null
          redirected_to_portal_at: string | null
          status: string | null
          transport_purpose: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_data?: Json | null
          animal_category?: string | null
          animal_count: number
          animal_species: string
          created_at?: string
          destination_property_data?: Json | null
          destination_uf: string
          freight_id?: string | null
          gta_uploaded_at?: string | null
          id?: string
          origin_property_data?: Json | null
          origin_uf: string
          portal_url_used?: string | null
          redirected_to_portal_at?: string | null
          status?: string | null
          transport_purpose: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_data?: Json | null
          animal_category?: string | null
          animal_count?: number
          animal_species?: string
          created_at?: string
          destination_property_data?: Json | null
          destination_uf?: string
          freight_id?: string | null
          gta_uploaded_at?: string | null
          id?: string
          origin_property_data?: Json | null
          origin_uf?: string
          portal_url_used?: string | null
          redirected_to_portal_at?: string | null
          status?: string | null
          transport_purpose?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gta_assisted_drafts_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gta_assisted_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gta_assisted_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      gta_interstate_rules: {
        Row: {
          additional_docs_list: string[] | null
          allowed: boolean | null
          animal_species: string | null
          created_at: string | null
          destination_uf: string
          effective_from: string | null
          effective_until: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          origin_uf: string
          requires_additional_docs: boolean | null
          updated_at: string | null
        }
        Insert: {
          additional_docs_list?: string[] | null
          allowed?: boolean | null
          animal_species?: string | null
          created_at?: string | null
          destination_uf: string
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_uf: string
          requires_additional_docs?: boolean | null
          updated_at?: string | null
        }
        Update: {
          additional_docs_list?: string[] | null
          allowed?: boolean | null
          animal_species?: string | null
          created_at?: string | null
          destination_uf?: string
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_uf?: string
          requires_additional_docs?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gta_ocr_validations: {
        Row: {
          confidence_score: number | null
          created_at: string
          extracted_data: Json
          extraction_errors: Json | null
          fraud_indicators: Json | null
          id: string
          livestock_compliance_id: string | null
          ocr_raw_text: string | null
          risk_score: number | null
          sanitary_document_id: string | null
          validated_at: string
          validated_by: string | null
          validation_result: Json
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          extracted_data?: Json
          extraction_errors?: Json | null
          fraud_indicators?: Json | null
          id?: string
          livestock_compliance_id?: string | null
          ocr_raw_text?: string | null
          risk_score?: number | null
          sanitary_document_id?: string | null
          validated_at?: string
          validated_by?: string | null
          validation_result?: Json
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          extracted_data?: Json
          extraction_errors?: Json | null
          fraud_indicators?: Json | null
          id?: string
          livestock_compliance_id?: string | null
          ocr_raw_text?: string | null
          risk_score?: number | null
          sanitary_document_id?: string | null
          validated_at?: string
          validated_by?: string | null
          validation_result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "gta_ocr_validations_livestock_compliance_id_fkey"
            columns: ["livestock_compliance_id"]
            isOneToOne: false
            referencedRelation: "livestock_freight_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gta_ocr_validations_sanitary_document_id_fkey"
            columns: ["sanitary_document_id"]
            isOneToOne: false
            referencedRelation: "freight_sanitary_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gta_ocr_validations_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gta_ocr_validations_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      gta_state_rules: {
        Row: {
          additional_requirements: Json | null
          created_at: string
          gta_format: string
          id: string
          is_active: boolean | null
          issuing_agency_code: string
          issuing_agency_name: string
          issuing_agency_url: string | null
          max_validity_hours: number
          portal_url: string | null
          requires_gta: boolean
          special_notes: string | null
          state_name: string
          uf: string
          updated_at: string
        }
        Insert: {
          additional_requirements?: Json | null
          created_at?: string
          gta_format: string
          id?: string
          is_active?: boolean | null
          issuing_agency_code: string
          issuing_agency_name: string
          issuing_agency_url?: string | null
          max_validity_hours?: number
          portal_url?: string | null
          requires_gta?: boolean
          special_notes?: string | null
          state_name: string
          uf: string
          updated_at?: string
        }
        Update: {
          additional_requirements?: Json | null
          created_at?: string
          gta_format?: string
          id?: string
          is_active?: boolean | null
          issuing_agency_code?: string
          issuing_agency_name?: string
          issuing_agency_url?: string | null
          max_validity_hours?: number
          portal_url?: string | null
          requires_gta?: boolean
          special_notes?: string | null
          state_name?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_freight_security_log: {
        Row: {
          created_at: string
          document_hash: string | null
          fingerprint_hash: string
          freight_id: string | null
          id: string
          ip: string
          metadata: Json | null
          phone_hash: string | null
          reason_code: string
          result: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          document_hash?: string | null
          fingerprint_hash: string
          freight_id?: string | null
          id?: string
          ip: string
          metadata?: Json | null
          phone_hash?: string | null
          reason_code: string
          result: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          document_hash?: string | null
          fingerprint_hash?: string
          freight_id?: string | null
          id?: string
          ip?: string
          metadata?: Json | null
          phone_hash?: string | null
          reason_code?: string
          result?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_freight_security_log_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
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
      hero_backgrounds: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          mobile_image_url: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          mobile_image_url?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          mobile_image_url?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
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
      inspection_access_logs: {
        Row: {
          access_granted: boolean | null
          accessed_at: string | null
          data_categories_accessed: string[] | null
          denial_reason: string | null
          freight_id: string | null
          geo_location: Json | null
          id: string
          ip_address: unknown
          qr_code_hash: string
          user_agent: string | null
        }
        Insert: {
          access_granted?: boolean | null
          accessed_at?: string | null
          data_categories_accessed?: string[] | null
          denial_reason?: string | null
          freight_id?: string | null
          geo_location?: Json | null
          id?: string
          ip_address?: unknown
          qr_code_hash: string
          user_agent?: string | null
        }
        Update: {
          access_granted?: boolean | null
          accessed_at?: string | null
          data_categories_accessed?: string[] | null
          denial_reason?: string | null
          freight_id?: string | null
          geo_location?: Json | null
          id?: string
          ip_address?: unknown
          qr_code_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_access_logs_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_qr_codes: {
        Row: {
          access_count: number
          created_at: string
          expires_at: string
          freight_id: string
          generated_at: string
          id: string
          is_active: boolean
          last_accessed_at: string | null
          last_accessed_by_ip: unknown
          livestock_compliance_id: string | null
          qr_code_data: Json
          qr_code_hash: string
          updated_at: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          expires_at: string
          freight_id: string
          generated_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          last_accessed_by_ip?: unknown
          livestock_compliance_id?: string | null
          qr_code_data?: Json
          qr_code_hash: string
          updated_at?: string
        }
        Update: {
          access_count?: number
          created_at?: string
          expires_at?: string
          freight_id?: string
          generated_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          last_accessed_by_ip?: unknown
          livestock_compliance_id?: string | null
          qr_code_data?: Json
          qr_code_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_qr_codes_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_qr_codes_livestock_compliance_id_fkey"
            columns: ["livestock_compliance_id"]
            isOneToOne: false
            referencedRelation: "livestock_freight_compliance"
            referencedColumns: ["id"]
          },
        ]
      }
      livestock_freight_compliance: {
        Row: {
          animal_breed: string | null
          animal_category: string | null
          animal_count: number
          animal_species: string
          approved_at: string | null
          approved_by: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocking_reasons: Json | null
          compliance_checklist: Json | null
          compliance_status: string
          created_at: string
          destination_property_code: string | null
          destination_property_name: string | null
          fraud_indicators: Json | null
          freight_id: string
          gta_document_id: string | null
          id: string
          nfe_document_id: string | null
          origin_property_code: string | null
          origin_property_name: string | null
          risk_score: number | null
          transport_purpose: string
          updated_at: string
        }
        Insert: {
          animal_breed?: string | null
          animal_category?: string | null
          animal_count: number
          animal_species: string
          approved_at?: string | null
          approved_by?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocking_reasons?: Json | null
          compliance_checklist?: Json | null
          compliance_status?: string
          created_at?: string
          destination_property_code?: string | null
          destination_property_name?: string | null
          fraud_indicators?: Json | null
          freight_id: string
          gta_document_id?: string | null
          id?: string
          nfe_document_id?: string | null
          origin_property_code?: string | null
          origin_property_name?: string | null
          risk_score?: number | null
          transport_purpose: string
          updated_at?: string
        }
        Update: {
          animal_breed?: string | null
          animal_category?: string | null
          animal_count?: number
          animal_species?: string
          approved_at?: string | null
          approved_by?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocking_reasons?: Json | null
          compliance_checklist?: Json | null
          compliance_status?: string
          created_at?: string
          destination_property_code?: string | null
          destination_property_name?: string | null
          fraud_indicators?: Json | null
          freight_id?: string
          gta_document_id?: string | null
          id?: string
          nfe_document_id?: string | null
          origin_property_code?: string | null
          origin_property_name?: string | null
          risk_score?: number | null
          transport_purpose?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestock_freight_compliance_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestock_freight_compliance_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestock_freight_compliance_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestock_freight_compliance_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestock_freight_compliance_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: true
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestock_freight_compliance_gta_document_id_fkey"
            columns: ["gta_document_id"]
            isOneToOne: false
            referencedRelation: "freight_sanitary_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      location_chat_log: {
        Row: {
          driver_profile_id: string
          freight_id: string
          id: string
          last_sent_at: string
          message_id: string | null
        }
        Insert: {
          driver_profile_id: string
          freight_id: string
          id?: string
          last_sent_at?: string
          message_id?: string | null
        }
        Update: {
          driver_profile_id?: string
          freight_id?: string
          id?: string
          last_sent_at?: string
          message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_chat_log_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_chat_log_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_chat_log_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_chat_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "freight_messages"
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
      match_alert_state: {
        Row: {
          fail_streak: number
          is_open: boolean
          key: string
          last_fail_at: string | null
          last_ok_at: string | null
          last_sent_at: string | null
          updated_at: string
        }
        Insert: {
          fail_streak?: number
          is_open?: boolean
          key: string
          last_fail_at?: string | null
          last_ok_at?: string | null
          last_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          fail_streak?: number
          is_open?: boolean
          key?: string
          last_fail_at?: string | null
          last_ok_at?: string | null
          last_sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      match_debug_logs: {
        Row: {
          error: string | null
          feed_type: string
          filters: Json
          finished_at: string | null
          id: string
          request_id: string
          sample: Json
          started_at: string
          stats: Json
          viewer_role: string
          viewer_user_id: string
        }
        Insert: {
          error?: string | null
          feed_type: string
          filters?: Json
          finished_at?: string | null
          id?: string
          request_id?: string
          sample?: Json
          started_at?: string
          stats?: Json
          viewer_role: string
          viewer_user_id: string
        }
        Update: {
          error?: string | null
          feed_type?: string
          filters?: Json
          finished_at?: string | null
          id?: string
          request_id?: string
          sample?: Json
          started_at?: string
          stats?: Json
          viewer_role?: string
          viewer_user_id?: string
        }
        Relationships: []
      }
      match_exposures: {
        Row: {
          city_id: string | null
          distance_km: number | null
          expires_at: string
          first_seen_at: string
          id: string
          item_id: string
          item_type: string
          last_seen_at: string
          meta: Json
          score: number | null
          seen_count: number
          status: string
          viewer_user_id: string
        }
        Insert: {
          city_id?: string | null
          distance_km?: number | null
          expires_at?: string
          first_seen_at?: string
          id?: string
          item_id: string
          item_type: string
          last_seen_at?: string
          meta?: Json
          score?: number | null
          seen_count?: number
          status?: string
          viewer_user_id: string
        }
        Update: {
          city_id?: string | null
          distance_km?: number | null
          expires_at?: string
          first_seen_at?: string
          id?: string
          item_id?: string
          item_type?: string
          last_seen_at?: string
          meta?: Json
          score?: number | null
          seen_count?: number
          status?: string
          viewer_user_id?: string
        }
        Relationships: []
      }
      match_interactions: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          id: string
          item_id: string
          item_kind: string
          metadata: Json
          role: string
          user_id: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          item_kind: string
          metadata?: Json
          role: string
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          item_kind?: string
          metadata?: Json
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      match_telemetry: {
        Row: {
          check_name: string
          city_ids_count: number
          city_pairs_count: number
          created_at: string
          displayed_freights_count: number
          displayed_services_count: number
          duration_ms: number | null
          env: string
          failure_code: string | null
          failure_detail: Json | null
          feed_total_displayed: number | null
          feed_total_eligible: number | null
          id: number
          ok: boolean
          role: string | null
          rpc_freights_count: number
          rpc_services_count: number
          source: string
          user_id: string | null
        }
        Insert: {
          check_name?: string
          city_ids_count?: number
          city_pairs_count?: number
          created_at?: string
          displayed_freights_count?: number
          displayed_services_count?: number
          duration_ms?: number | null
          env?: string
          failure_code?: string | null
          failure_detail?: Json | null
          feed_total_displayed?: number | null
          feed_total_eligible?: number | null
          id?: number
          ok?: boolean
          role?: string | null
          rpc_freights_count?: number
          rpc_services_count?: number
          source?: string
          user_id?: string | null
        }
        Update: {
          check_name?: string
          city_ids_count?: number
          city_pairs_count?: number
          created_at?: string
          displayed_freights_count?: number
          displayed_services_count?: number
          duration_ms?: number | null
          env?: string
          failure_code?: string | null
          failure_detail?: Json | null
          feed_total_displayed?: number | null
          feed_total_eligible?: number | null
          id?: number
          ok?: boolean
          role?: string | null
          rpc_freights_count?: number
          rpc_services_count?: number
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mdfe_condutores: {
        Row: {
          cpf: string
          created_at: string
          driver_id: string | null
          id: string
          mdfe_id: string
          nome: string
        }
        Insert: {
          cpf: string
          created_at?: string
          driver_id?: string | null
          id?: string
          mdfe_id: string
          nome: string
        }
        Update: {
          cpf?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          mdfe_id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_condutores_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_condutores_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_condutores_mdfe_id_fkey"
            columns: ["mdfe_id"]
            isOneToOne: false
            referencedRelation: "mdfe_manifestos"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_config: {
        Row: {
          ambiente_fiscal: string | null
          auto_close_on_delivery: boolean
          auto_emit_on_acceptance: boolean
          bairro: string | null
          cep: string | null
          cnpj: string | null
          company_id: string | null
          created_at: string
          id: string
          inscricao_estadual: string | null
          logradouro: string | null
          municipio_codigo: string | null
          municipio_nome: string | null
          nome_fantasia: string | null
          numero: string | null
          razao_social: string | null
          rntrc: string | null
          serie_mdfe: string
          telefone: string | null
          uf: string | null
          ultimo_numero_mdfe: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ambiente_fiscal?: string | null
          auto_close_on_delivery?: boolean
          auto_emit_on_acceptance?: boolean
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          municipio_codigo?: string | null
          municipio_nome?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          rntrc?: string | null
          serie_mdfe?: string
          telefone?: string | null
          uf?: string | null
          ultimo_numero_mdfe?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ambiente_fiscal?: string | null
          auto_close_on_delivery?: boolean
          auto_emit_on_acceptance?: boolean
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          municipio_codigo?: string | null
          municipio_nome?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          rntrc?: string | null
          serie_mdfe?: string
          telefone?: string | null
          uf?: string | null
          ultimo_numero_mdfe?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_documentos: {
        Row: {
          chave_acesso: string
          created_at: string
          id: string
          mdfe_id: string
          numero_documento: string
          peso_kg: number | null
          serie_documento: string
          tipo_documento: Database["public"]["Enums"]["mdfe_documento_tipo"]
          tipo_unidade: string | null
          unidade_medida: string | null
          valor: number
        }
        Insert: {
          chave_acesso: string
          created_at?: string
          id?: string
          mdfe_id: string
          numero_documento: string
          peso_kg?: number | null
          serie_documento: string
          tipo_documento: Database["public"]["Enums"]["mdfe_documento_tipo"]
          tipo_unidade?: string | null
          unidade_medida?: string | null
          valor: number
        }
        Update: {
          chave_acesso?: string
          created_at?: string
          id?: string
          mdfe_id?: string
          numero_documento?: string
          peso_kg?: number | null
          serie_documento?: string
          tipo_documento?: Database["public"]["Enums"]["mdfe_documento_tipo"]
          tipo_unidade?: string | null
          unidade_medida?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_documentos_mdfe_id_fkey"
            columns: ["mdfe_id"]
            isOneToOne: false
            referencedRelation: "mdfe_manifestos"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_logs: {
        Row: {
          created_at: string
          id: string
          mdfe_id: string
          mensagem_sefaz: string | null
          observacao: string | null
          status_code: string | null
          sucesso: boolean
          tipo_operacao: string
          user_id: string | null
          xml_enviado: string | null
          xml_resposta: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mdfe_id: string
          mensagem_sefaz?: string | null
          observacao?: string | null
          status_code?: string | null
          sucesso?: boolean
          tipo_operacao: string
          user_id?: string | null
          xml_enviado?: string | null
          xml_resposta?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mdfe_id?: string
          mensagem_sefaz?: string | null
          observacao?: string | null
          status_code?: string | null
          sucesso?: boolean
          tipo_operacao?: string
          user_id?: string | null
          xml_enviado?: string | null
          xml_resposta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_logs_mdfe_id_fkey"
            columns: ["mdfe_id"]
            isOneToOne: false
            referencedRelation: "mdfe_manifestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_manifestos: {
        Row: {
          ambiente_fiscal: string | null
          chave_acesso: string
          cne_test: string | null
          company_id: string | null
          created_at: string
          dacte_url: string | null
          data_autorizacao: string | null
          data_emissao: string
          data_encerramento: string | null
          emitted_by_id: string
          emitter_type: Database["public"]["Enums"]["mdfe_emitter_type"]
          freight_id: string
          id: string
          mensagem_erro: string | null
          modo_emissao: Database["public"]["Enums"]["mdfe_modo_emissao"]
          motivo_cancelamento: string | null
          municipio_carregamento_codigo: string
          municipio_carregamento_nome: string
          municipio_descarregamento_codigo: string
          municipio_descarregamento_nome: string
          numero_mdfe: string
          observacoes: string | null
          peso_bruto_kg: number
          protocolo_autorizacao: string | null
          referencia_focus: string | null
          resposta_sefaz: Json | null
          serie: string
          status: Database["public"]["Enums"]["mdfe_status"]
          uf_fim: string
          uf_inicio: string
          updated_at: string
          valor_carga: number
          xml_assinado: string | null
          xml_contingencia: string | null
          xml_url: string | null
        }
        Insert: {
          ambiente_fiscal?: string | null
          chave_acesso: string
          cne_test?: string | null
          company_id?: string | null
          created_at?: string
          dacte_url?: string | null
          data_autorizacao?: string | null
          data_emissao?: string
          data_encerramento?: string | null
          emitted_by_id: string
          emitter_type: Database["public"]["Enums"]["mdfe_emitter_type"]
          freight_id: string
          id?: string
          mensagem_erro?: string | null
          modo_emissao?: Database["public"]["Enums"]["mdfe_modo_emissao"]
          motivo_cancelamento?: string | null
          municipio_carregamento_codigo: string
          municipio_carregamento_nome: string
          municipio_descarregamento_codigo: string
          municipio_descarregamento_nome: string
          numero_mdfe: string
          observacoes?: string | null
          peso_bruto_kg: number
          protocolo_autorizacao?: string | null
          referencia_focus?: string | null
          resposta_sefaz?: Json | null
          serie?: string
          status?: Database["public"]["Enums"]["mdfe_status"]
          uf_fim: string
          uf_inicio: string
          updated_at?: string
          valor_carga: number
          xml_assinado?: string | null
          xml_contingencia?: string | null
          xml_url?: string | null
        }
        Update: {
          ambiente_fiscal?: string | null
          chave_acesso?: string
          cne_test?: string | null
          company_id?: string | null
          created_at?: string
          dacte_url?: string | null
          data_autorizacao?: string | null
          data_emissao?: string
          data_encerramento?: string | null
          emitted_by_id?: string
          emitter_type?: Database["public"]["Enums"]["mdfe_emitter_type"]
          freight_id?: string
          id?: string
          mensagem_erro?: string | null
          modo_emissao?: Database["public"]["Enums"]["mdfe_modo_emissao"]
          motivo_cancelamento?: string | null
          municipio_carregamento_codigo?: string
          municipio_carregamento_nome?: string
          municipio_descarregamento_codigo?: string
          municipio_descarregamento_nome?: string
          numero_mdfe?: string
          observacoes?: string | null
          peso_bruto_kg?: number
          protocolo_autorizacao?: string | null
          referencia_focus?: string | null
          resposta_sefaz?: Json | null
          serie?: string
          status?: Database["public"]["Enums"]["mdfe_status"]
          uf_fim?: string
          uf_inicio?: string
          updated_at?: string
          valor_carga?: number
          xml_assinado?: string | null
          xml_contingencia?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_manifestos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_manifestos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_manifestos_emitted_by_id_fkey"
            columns: ["emitted_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_manifestos_emitted_by_id_fkey"
            columns: ["emitted_by_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_manifestos_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_veiculos: {
        Row: {
          capacidade_kg: number
          created_at: string
          id: string
          mdfe_id: string
          placa: string
          renavam: string
          tara: number
          tipo_carroceria: string
          tipo_proprietario: Database["public"]["Enums"]["mdfe_tipo_proprietario"]
          tipo_rodado: string
          vehicle_id: string | null
        }
        Insert: {
          capacidade_kg: number
          created_at?: string
          id?: string
          mdfe_id: string
          placa: string
          renavam: string
          tara: number
          tipo_carroceria: string
          tipo_proprietario?: Database["public"]["Enums"]["mdfe_tipo_proprietario"]
          tipo_rodado: string
          vehicle_id?: string | null
        }
        Update: {
          capacidade_kg?: number
          created_at?: string
          id?: string
          mdfe_id?: string
          placa?: string
          renavam?: string
          tara?: number
          tipo_carroceria?: string
          tipo_proprietario?: Database["public"]["Enums"]["mdfe_tipo_proprietario"]
          tipo_rodado?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_veiculos_mdfe_id_fkey"
            columns: ["mdfe_id"]
            isOneToOne: false
            referencedRelation: "mdfe_manifestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_veiculos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_veiculos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      nfa_documents: {
        Row: {
          access_key: string | null
          amount: number | null
          created_at: string
          description: string | null
          freight_id: string | null
          id: string
          observations: string | null
          pdf_url: string | null
          recipient_doc: string | null
          recipient_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_key?: string | null
          amount?: number | null
          created_at?: string
          description?: string | null
          freight_id?: string | null
          id?: string
          observations?: string | null
          pdf_url?: string | null
          recipient_doc?: string | null
          recipient_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_key?: string | null
          amount?: number | null
          created_at?: string
          description?: string | null
          freight_id?: string | null
          id?: string
          observations?: string | null
          pdf_url?: string | null
          recipient_doc?: string | null
          recipient_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfa_documents_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_documents: {
        Row: {
          access_key: string
          created_at: string | null
          created_by: string | null
          freight_id: string | null
          id: string
          issue_date: string
          issuer_cnpj: string
          issuer_name: string
          manifestation_date: string | null
          manifestation_justification: string | null
          manifestation_mode: string | null
          manifestation_type: string | null
          number: string
          portal_redirect_at: string | null
          series: string
          status: string
          updated_at: string | null
          user_declaration_at: string | null
          value: number
        }
        Insert: {
          access_key: string
          created_at?: string | null
          created_by?: string | null
          freight_id?: string | null
          id?: string
          issue_date: string
          issuer_cnpj: string
          issuer_name: string
          manifestation_date?: string | null
          manifestation_justification?: string | null
          manifestation_mode?: string | null
          manifestation_type?: string | null
          number: string
          portal_redirect_at?: string | null
          series: string
          status?: string
          updated_at?: string | null
          user_declaration_at?: string | null
          value: number
        }
        Update: {
          access_key?: string
          created_at?: string | null
          created_by?: string | null
          freight_id?: string | null
          id?: string
          issue_date?: string
          issuer_cnpj?: string
          issuer_name?: string
          manifestation_date?: string | null
          manifestation_justification?: string | null
          manifestation_mode?: string | null
          manifestation_type?: string | null
          number?: string
          portal_redirect_at?: string | null
          series?: string
          status?: string
          updated_at?: string | null
          user_declaration_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfe_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_documents_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_emissions: {
        Row: {
          access_key: string | null
          antifraud_events: Json | null
          antifraud_score: number | null
          antifraud_status: string | null
          authorization_date: string | null
          canceled_by: string | null
          cancellation_date: string | null
          cancellation_justification: string | null
          cancellation_protocol: string | null
          cfop: string
          correction_letters: Json | null
          created_at: string
          created_by: string
          danfe_url: string | null
          emission_context: Json | null
          emission_cost: number
          emission_paid: boolean | null
          error_code: string | null
          error_message: string | null
          fiscal_environment: string
          focus_nfe_ref: string | null
          focus_nfe_response: Json | null
          freight_id: string | null
          id: string
          internal_ref: string
          issue_date: string | null
          issuer_address: Json
          issuer_document: string
          issuer_id: string
          issuer_ie: string | null
          issuer_name: string
          items: Json
          model: string
          number: number | null
          operation_nature: string
          payment_data: Json | null
          payment_method: string | null
          recipient_address: Json | null
          recipient_document: string | null
          recipient_document_type: string | null
          recipient_email: string | null
          recipient_ie: string | null
          recipient_name: string
          recipient_phone: string | null
          rejection_reason: string | null
          sefaz_protocol: string | null
          sefaz_response: Json | null
          sefaz_status_code: string | null
          sefaz_status_message: string | null
          series: number | null
          status: string
          status_history: Json | null
          totals: Json
          transport_data: Json | null
          transport_mode: number | null
          updated_at: string
          wallet_id: string | null
          wallet_transaction_id: string | null
          xml_signed_hash: string | null
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          antifraud_events?: Json | null
          antifraud_score?: number | null
          antifraud_status?: string | null
          authorization_date?: string | null
          canceled_by?: string | null
          cancellation_date?: string | null
          cancellation_justification?: string | null
          cancellation_protocol?: string | null
          cfop: string
          correction_letters?: Json | null
          created_at?: string
          created_by: string
          danfe_url?: string | null
          emission_context?: Json | null
          emission_cost?: number
          emission_paid?: boolean | null
          error_code?: string | null
          error_message?: string | null
          fiscal_environment?: string
          focus_nfe_ref?: string | null
          focus_nfe_response?: Json | null
          freight_id?: string | null
          id?: string
          internal_ref: string
          issue_date?: string | null
          issuer_address: Json
          issuer_document: string
          issuer_id: string
          issuer_ie?: string | null
          issuer_name: string
          items?: Json
          model?: string
          number?: number | null
          operation_nature: string
          payment_data?: Json | null
          payment_method?: string | null
          recipient_address?: Json | null
          recipient_document?: string | null
          recipient_document_type?: string | null
          recipient_email?: string | null
          recipient_ie?: string | null
          recipient_name: string
          recipient_phone?: string | null
          rejection_reason?: string | null
          sefaz_protocol?: string | null
          sefaz_response?: Json | null
          sefaz_status_code?: string | null
          sefaz_status_message?: string | null
          series?: number | null
          status?: string
          status_history?: Json | null
          totals: Json
          transport_data?: Json | null
          transport_mode?: number | null
          updated_at?: string
          wallet_id?: string | null
          wallet_transaction_id?: string | null
          xml_signed_hash?: string | null
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          antifraud_events?: Json | null
          antifraud_score?: number | null
          antifraud_status?: string | null
          authorization_date?: string | null
          canceled_by?: string | null
          cancellation_date?: string | null
          cancellation_justification?: string | null
          cancellation_protocol?: string | null
          cfop?: string
          correction_letters?: Json | null
          created_at?: string
          created_by?: string
          danfe_url?: string | null
          emission_context?: Json | null
          emission_cost?: number
          emission_paid?: boolean | null
          error_code?: string | null
          error_message?: string | null
          fiscal_environment?: string
          focus_nfe_ref?: string | null
          focus_nfe_response?: Json | null
          freight_id?: string | null
          id?: string
          internal_ref?: string
          issue_date?: string | null
          issuer_address?: Json
          issuer_document?: string
          issuer_id?: string
          issuer_ie?: string | null
          issuer_name?: string
          items?: Json
          model?: string
          number?: number | null
          operation_nature?: string
          payment_data?: Json | null
          payment_method?: string | null
          recipient_address?: Json | null
          recipient_document?: string | null
          recipient_document_type?: string | null
          recipient_email?: string | null
          recipient_ie?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          rejection_reason?: string | null
          sefaz_protocol?: string | null
          sefaz_response?: Json | null
          sefaz_status_code?: string | null
          sefaz_status_message?: string | null
          series?: number | null
          status?: string
          status_history?: Json | null
          totals?: Json
          transport_data?: Json | null
          transport_mode?: number | null
          updated_at?: string
          wallet_id?: string | null
          wallet_transaction_id?: string | null
          xml_signed_hash?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_emissions_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "fiscal_issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "fiscal_wallet"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
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
      offline_incidents: {
        Row: {
          created_at: string | null
          distance_gap_km: number | null
          driver_id: string | null
          duration_minutes: number | null
          ended_at: string | null
          first_return_lat: number | null
          first_return_lng: number | null
          freight_id: string
          id: string
          is_suspicious: boolean | null
          last_known_lat: number | null
          last_known_lng: number | null
          notes: string | null
          started_at: string
        }
        Insert: {
          created_at?: string | null
          distance_gap_km?: number | null
          driver_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          first_return_lat?: number | null
          first_return_lng?: number | null
          freight_id: string
          id?: string
          is_suspicious?: boolean | null
          last_known_lat?: number | null
          last_known_lng?: number | null
          notes?: string | null
          started_at: string
        }
        Update: {
          created_at?: string | null
          distance_gap_km?: number | null
          driver_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          first_return_lat?: number | null
          first_return_lng?: number | null
          freight_id?: string
          id?: string
          is_suspicious?: boolean | null
          last_known_lat?: number | null
          last_known_lng?: number | null
          notes?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_incidents_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_history: {
        Row: {
          completed_at: string
          destination_location: string | null
          entity_type: string
          final_price: number | null
          final_status: string
          guest_contact_name: string | null
          guest_contact_phone: string | null
          id: string
          operation_created_at: string
          origin_location: string | null
          original_id: string
          rating_completed: boolean | null
          recorded_at: string
          service_or_cargo_type: string | null
          snapshot_data: Json | null
          truck_count: number | null
          user_id: string | null
          user_role: string
        }
        Insert: {
          completed_at?: string
          destination_location?: string | null
          entity_type: string
          final_price?: number | null
          final_status?: string
          guest_contact_name?: string | null
          guest_contact_phone?: string | null
          id?: string
          operation_created_at: string
          origin_location?: string | null
          original_id: string
          rating_completed?: boolean | null
          recorded_at?: string
          service_or_cargo_type?: string | null
          snapshot_data?: Json | null
          truck_count?: number | null
          user_id?: string | null
          user_role: string
        }
        Update: {
          completed_at?: string
          destination_location?: string | null
          entity_type?: string
          final_price?: number | null
          final_status?: string
          guest_contact_name?: string | null
          guest_contact_phone?: string | null
          id?: string
          operation_created_at?: string
          origin_location?: string | null
          original_id?: string
          rating_completed?: boolean | null
          recorded_at?: string
          service_or_cargo_type?: string | null
          snapshot_data?: Json | null
          truck_count?: number | null
          user_id?: string | null
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
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
      premium_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          features: Json | null
          id: string
          plan_type: string
          profile_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          features?: Json | null
          id?: string
          plan_type?: string
          profile_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          features?: Json | null
          id?: string
          plan_type?: string
          profile_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "fk_producer_id"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          admin_message: string | null
          admin_message_category: string | null
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
          admin_message?: string | null
          admin_message_category?: string | null
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
          admin_message?: string | null
          admin_message_category?: string | null
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
          {
            foreignKeyName: "profiles_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_encrypted_data: {
        Row: {
          address_city_encrypted: string | null
          address_complement_encrypted: string | null
          address_neighborhood_encrypted: string | null
          address_number_encrypted: string | null
          address_state_encrypted: string | null
          address_street_encrypted: string | null
          address_zip_encrypted: string | null
          contact_phone_encrypted: string | null
          cpf_cnpj_encrypted: string | null
          emergency_contact_phone_encrypted: string | null
          encrypted_at: string | null
          farm_address_encrypted: string | null
          fixed_address_encrypted: string | null
          id: string
          phone_encrypted: string | null
          updated_at: string | null
        }
        Insert: {
          address_city_encrypted?: string | null
          address_complement_encrypted?: string | null
          address_neighborhood_encrypted?: string | null
          address_number_encrypted?: string | null
          address_state_encrypted?: string | null
          address_street_encrypted?: string | null
          address_zip_encrypted?: string | null
          contact_phone_encrypted?: string | null
          cpf_cnpj_encrypted?: string | null
          emergency_contact_phone_encrypted?: string | null
          encrypted_at?: string | null
          farm_address_encrypted?: string | null
          fixed_address_encrypted?: string | null
          id: string
          phone_encrypted?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city_encrypted?: string | null
          address_complement_encrypted?: string | null
          address_neighborhood_encrypted?: string | null
          address_number_encrypted?: string | null
          address_state_encrypted?: string | null
          address_street_encrypted?: string | null
          address_zip_encrypted?: string | null
          contact_phone_encrypted?: string | null
          cpf_cnpj_encrypted?: string | null
          emergency_contact_phone_encrypted?: string | null
          encrypted_at?: string | null
          farm_address_encrypted?: string | null
          fixed_address_encrypted?: string | null
          id?: string
          phone_encrypted?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_encrypted_data_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_encrypted_data_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
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
      proposal_chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          image_url: string | null
          message_type: string
          proposal_id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          message_type: string
          proposal_id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          message_type?: string
          proposal_id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_chat_messages_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "freight_proposals"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_config: {
        Row: {
          block_duration_minutes: number
          burst_limit: number
          created_at: string | null
          description: string | null
          endpoint_pattern: string
          id: string
          is_active: boolean | null
          max_requests_per_hour: number
          max_requests_per_minute: number
          updated_at: string | null
        }
        Insert: {
          block_duration_minutes?: number
          burst_limit?: number
          created_at?: string | null
          description?: string | null
          endpoint_pattern: string
          id?: string
          is_active?: boolean | null
          max_requests_per_hour?: number
          max_requests_per_minute?: number
          updated_at?: string | null
        }
        Update: {
          block_duration_minutes?: number
          burst_limit?: number
          created_at?: string | null
          description?: string | null
          endpoint_pattern?: string
          id?: string
          is_active?: boolean | null
          max_requests_per_hour?: number
          max_requests_per_minute?: number
          updated_at?: string | null
        }
        Relationships: []
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
      report_exports: {
        Row: {
          completed_at: string | null
          created_at: string
          date_range_from: string | null
          date_range_to: string | null
          error_message: string | null
          file_size_bytes: number | null
          file_url: string | null
          format: string
          id: string
          metadata: Json | null
          profile_id: string | null
          report_type: string
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date_range_from?: string | null
          date_range_to?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format: string
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          report_type: string
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date_range_from?: string | null
          date_range_to?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          report_type?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_exports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_exports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      reports_daily_metrics: {
        Row: {
          avg_price: number | null
          by_service_type: Json | null
          created_at: string | null
          entity_type: string
          id: string
          metric_date: string
          region: string
          total_cancelled: number | null
          total_completed: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          avg_price?: number | null
          by_service_type?: Json | null
          created_at?: string | null
          entity_type: string
          id?: string
          metric_date: string
          region?: string
          total_cancelled?: number | null
          total_completed?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_price?: number | null
          by_service_type?: Json | null
          created_at?: string | null
          entity_type?: string
          id?: string
          metric_date?: string
          region?: string
          total_cancelled?: number | null
          total_completed?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rewards: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          name: string
          required_level: number | null
          required_xp: number | null
          reward_type: string
          value: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          name: string
          required_level?: number | null
          required_xp?: number | null
          reward_type: string
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          name?: string
          required_level?: number | null
          required_xp?: number | null
          reward_type?: string
          value?: number | null
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
          {
            foreignKeyName: "role_correction_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      route_deviations: {
        Row: {
          created_at: string | null
          detected_at: string
          deviation_km: number
          expected_lat: number | null
          expected_lng: number | null
          freight_id: string
          id: string
          lat: number
          lng: number
          notes: string | null
          resolved: boolean | null
          severity: string | null
        }
        Insert: {
          created_at?: string | null
          detected_at?: string
          deviation_km: number
          expected_lat?: number | null
          expected_lng?: number | null
          freight_id: string
          id?: string
          lat: number
          lng: number
          notes?: string | null
          resolved?: boolean | null
          severity?: string | null
        }
        Update: {
          created_at?: string | null
          detected_at?: string
          deviation_km?: number
          expected_lat?: number | null
          expected_lng?: number | null
          freight_id?: string
          id?: string
          lat?: number
          lng?: number
          notes?: string | null
          resolved?: boolean | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_deviations_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
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
            foreignKeyName: "security_alerts_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      security_definer_audit: {
        Row: {
          audited_by: string
          created_at: string | null
          function_name: string
          id: string
          justification: string
          last_audit_date: string
          schema_name: string
        }
        Insert: {
          audited_by: string
          created_at?: string | null
          function_name: string
          id?: string
          justification: string
          last_audit_date: string
          schema_name?: string
        }
        Update: {
          audited_by?: string
          created_at?: string | null
          function_name?: string
          id?: string
          justification?: string
          last_audit_date?: string
          schema_name?: string
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
          delivered_at: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          image_url: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          message: string
          message_type: string
          read_at: string | null
          sender_id: string
          service_request_id: string
        }
        Insert: {
          chat_closed_by?: Json | null
          created_at?: string
          delivered_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message: string
          message_type?: string
          read_at?: string | null
          sender_id: string
          service_request_id: string
        }
        Update: {
          chat_closed_by?: Json | null
          created_at?: string
          delivered_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
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
            foreignKeyName: "service_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_messages_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_messages_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests_secure"
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
          {
            foreignKeyName: "fk_service_provider_areas_provider"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          {
            foreignKeyName: "service_provider_balances_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
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
          {
            foreignKeyName: "service_providers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "service_ratings_rated_user_id_fkey"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "service_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_history: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          city: string | null
          client_id: string | null
          completed_at: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          estimated_price: number | null
          final_price: number | null
          id: string
          provider_id: string | null
          service_request_id: string
          service_type: string | null
          source: string
          state: string | null
          status_final: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          city?: string | null
          client_id?: string | null
          completed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          provider_id?: string | null
          service_request_id: string
          service_type?: string | null
          source?: string
          state?: string | null
          status_final: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          city?: string | null
          client_id?: string | null
          completed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          provider_id?: string | null
          service_request_id?: string
          service_type?: string | null
          source?: string
          state?: string | null
          status_final?: string
        }
        Relationships: []
      }
      service_request_matches: {
        Row: {
          created_at: string
          distance_m: number
          driver_id: string
          id: string
          match_score: number
          match_type: string
          service_request_id: string
        }
        Insert: {
          created_at?: string
          distance_m?: number
          driver_id: string
          id?: string
          match_score?: number
          match_type: string
          service_request_id: string
        }
        Update: {
          created_at?: string
          distance_m?: number
          driver_id?: string
          id?: string
          match_score?: number
          match_type?: string
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_matches_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_matches_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_matches_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_matches_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_proposals: {
        Row: {
          created_at: string
          id: string
          message: string | null
          proposed_price: number
          proposer_id: string
          proposer_role: string
          rejection_reason: string | null
          responded_at: string | null
          service_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          proposed_price: number
          proposer_id: string
          proposer_role: string
          rejection_reason?: string | null
          responded_at?: string | null
          service_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          proposed_price?: number
          proposer_id?: string
          proposer_role?: string
          rejection_reason?: string | null
          responded_at?: string | null
          service_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_proposals_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_proposals_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests_secure"
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
          destination_address: string | null
          destination_city: string | null
          destination_lat: number | null
          destination_lng: number | null
          destination_state: string | null
          estimated_price: number | null
          expires_at: string | null
          final_price: number | null
          id: string
          in_progress_at: string | null
          is_emergency: boolean | null
          location_address: string
          location_address_encrypted: string | null
          location_city: string | null
          location_lat: number | null
          location_lng: number | null
          location_state: string | null
          on_the_way_at: string | null
          preferred_datetime: string | null
          problem_description: string
          prospect_user_id: string | null
          provider_comment: string | null
          provider_id: string | null
          provider_notes: string | null
          provider_rating: number | null
          reference_number: number | null
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
          destination_address?: string | null
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_state?: string | null
          estimated_price?: number | null
          expires_at?: string | null
          final_price?: number | null
          id?: string
          in_progress_at?: string | null
          is_emergency?: boolean | null
          location_address: string
          location_address_encrypted?: string | null
          location_city?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_state?: string | null
          on_the_way_at?: string | null
          preferred_datetime?: string | null
          problem_description: string
          prospect_user_id?: string | null
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          reference_number?: number | null
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
          destination_address?: string | null
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_state?: string | null
          estimated_price?: number | null
          expires_at?: string | null
          final_price?: number | null
          id?: string
          in_progress_at?: string | null
          is_emergency?: boolean | null
          location_address?: string
          location_address_encrypted?: string | null
          location_city?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_state?: string | null
          on_the_way_at?: string | null
          preferred_datetime?: string | null
          problem_description?: string
          prospect_user_id?: string | null
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          reference_number?: number | null
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
            foreignKeyName: "fk_service_requests_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "fk_service_requests_provider"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      stop_events: {
        Row: {
          address: string | null
          created_at: string | null
          driver_id: string
          duration_minutes: number | null
          ended_at: string | null
          freight_id: string
          id: string
          is_known_point: boolean | null
          known_point_type: string | null
          lat: number
          lng: number
          reason: string | null
          risk_level: string | null
          speed_after: number | null
          speed_before: number | null
          started_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          driver_id: string
          duration_minutes?: number | null
          ended_at?: string | null
          freight_id: string
          id?: string
          is_known_point?: boolean | null
          known_point_type?: string | null
          lat: number
          lng: number
          reason?: string | null
          risk_level?: string | null
          speed_after?: number | null
          speed_before?: number | null
          started_at: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          driver_id?: string
          duration_minutes?: number | null
          ended_at?: string | null
          freight_id?: string
          id?: string
          is_known_point?: boolean | null
          known_point_type?: string | null
          lat?: number
          lng?: number
          reason?: string | null
          risk_level?: string | null
          speed_after?: number | null
          speed_before?: number | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_events_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
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
          archived: boolean | null
          category: string | null
          created_at: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          message: string
          metadata: Json | null
          priority: number | null
          starts_at: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          category?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          metadata?: Json | null
          priority?: number | null
          starts_at?: string | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          category?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          metadata?: Json | null
          priority?: number | null
          starts_at?: string | null
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
            foreignKeyName: "transport_companies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_companies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_companies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
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
      trip_progress_audit: {
        Row: {
          created_at: string
          driver_profile_id: string | null
          error_code: string | null
          error_message: string | null
          execution_ms: number | null
          freight_id: string
          id: string
          meta: Json
          new_status: string | null
          old_status: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          driver_profile_id?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_ms?: number | null
          freight_id: string
          id?: string
          meta?: Json
          new_status?: string | null
          old_status?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          driver_profile_id?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_ms?: number | null
          freight_id?: string
          id?: string
          meta?: Json
          new_status?: string | null
          old_status?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trip_progress_audit_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_progress_audit_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_progress_audit_freight_id_fkey"
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
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "validation_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_history_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_history_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photo_history: {
        Row: {
          created_at: string | null
          id: string
          is_visible: boolean | null
          photo_type: string | null
          photo_url: string
          removed_at: string | null
          uploaded_at: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          photo_type?: string | null
          photo_url: string
          removed_at?: string | null
          uploaded_at?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          photo_type?: string | null
          photo_url?: string
          removed_at?: string | null
          uploaded_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photo_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photo_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles_secure"
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
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_code_cache: {
        Row: {
          city_id: string | null
          city_name: string
          created_at: string | null
          expires_at: string | null
          last_updated: string | null
          lat: number | null
          lng: number | null
          neighborhood: string | null
          source: string
          state: string
          street: string | null
          zip_code: string
        }
        Insert: {
          city_id?: string | null
          city_name: string
          created_at?: string | null
          expires_at?: string | null
          last_updated?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          source: string
          state: string
          street?: string | null
          zip_code: string
        }
        Update: {
          city_id?: string | null
          city_name?: string
          created_at?: string | null
          expires_at?: string | null
          last_updated?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          source?: string
          state?: string
          street?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "zip_code_cache_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zip_code_cache_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "city_hierarchy"
            referencedColumns: ["city_id"]
          },
        ]
      }
    }
    Views: {
      balance_transactions_secure: {
        Row: {
          amount: number | null
          balance_after: number | null
          balance_before: number | null
          created_at: string | null
          description: string | null
          id: string | null
          provider_id: string | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
          stripe_payment_intent_id_masked: string | null
          stripe_payout_id_masked: string | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          balance_after?: never
          balance_before?: never
          created_at?: string | null
          description?: string | null
          id?: string | null
          provider_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          stripe_payment_intent_id_masked?: never
          stripe_payout_id_masked?: never
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          balance_after?: never
          balance_before?: never
          created_at?: string | null
          description?: string | null
          id?: string | null
          provider_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          stripe_payment_intent_id_masked?: never
          stripe_payout_id_masked?: never
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
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
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_stripe_accounts_secure: {
        Row: {
          account_status: string | null
          charges_enabled: boolean | null
          created_at: string | null
          driver_id: string | null
          id: string | null
          payouts_enabled: boolean | null
          pix_key_masked: string | null
          requirements_due: Json | null
          stripe_account_id_masked: string | null
          updated_at: string | null
        }
        Insert: {
          account_status?: string | null
          charges_enabled?: boolean | null
          created_at?: string | null
          driver_id?: string | null
          id?: string | null
          payouts_enabled?: boolean | null
          pix_key_masked?: never
          requirements_due?: Json | null
          stripe_account_id_masked?: never
          updated_at?: string | null
        }
        Update: {
          account_status?: string | null
          charges_enabled?: boolean | null
          created_at?: string | null
          driver_id?: string | null
          id?: string | null
          payouts_enabled?: boolean | null
          pix_key_masked?: never
          requirements_due?: Json | null
          stripe_account_id_masked?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      fiscal_certificates_secure: {
        Row: {
          certificate_type: string | null
          created_at: string | null
          has_certificate_file: boolean | null
          id: string | null
          is_expired: boolean | null
          is_valid: boolean | null
          issuer_cn: string | null
          issuer_id: string | null
          last_used_at: string | null
          purchase_amount: number | null
          purchase_date: string | null
          purchase_order_id: string | null
          purchase_provider: string | null
          purchased_via_platform: boolean | null
          serial_number: string | null
          status: string | null
          subject_cn: string | null
          subject_document: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          usage_count: number | null
          valid_from: string | null
          valid_until: string | null
          validation_error: string | null
        }
        Insert: {
          certificate_type?: string | null
          created_at?: string | null
          has_certificate_file?: never
          id?: string | null
          is_expired?: boolean | null
          is_valid?: boolean | null
          issuer_cn?: string | null
          issuer_id?: string | null
          last_used_at?: string | null
          purchase_amount?: number | null
          purchase_date?: string | null
          purchase_order_id?: string | null
          purchase_provider?: string | null
          purchased_via_platform?: boolean | null
          serial_number?: string | null
          status?: string | null
          subject_cn?: string | null
          subject_document?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
          validation_error?: string | null
        }
        Update: {
          certificate_type?: string | null
          created_at?: string | null
          has_certificate_file?: never
          id?: string | null
          is_expired?: boolean | null
          is_valid?: boolean | null
          issuer_cn?: string | null
          issuer_id?: string | null
          last_used_at?: string | null
          purchase_amount?: number | null
          purchase_date?: string | null
          purchase_order_id?: string | null
          purchase_provider?: string | null
          purchased_via_platform?: boolean | null
          serial_number?: string | null
          status?: string | null
          subject_cn?: string | null
          subject_document?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
          validation_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_certificates_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "fiscal_issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_payments_secure: {
        Row: {
          amount: number | null
          completed_at: string | null
          created_at: string | null
          external_transaction_masked: string | null
          freight_id: string | null
          id: string | null
          payer_id: string | null
          payment_method: string | null
          payment_type: string | null
          receiver_id: string | null
          status: string | null
          stripe_payment_intent_masked: string | null
          stripe_session_masked: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          external_transaction_masked?: never
          freight_id?: string | null
          id?: string | null
          payer_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
          receiver_id?: string | null
          status?: string | null
          stripe_payment_intent_masked?: never
          stripe_session_masked?: never
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          external_transaction_masked?: never
          freight_id?: string | null
          id?: string | null
          payer_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
          receiver_id?: string | null
          status?: string | null
          stripe_payment_intent_masked?: never
          stripe_session_masked?: never
          updated_at?: string | null
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
      identity_selfies_secure: {
        Row: {
          created_at: string | null
          has_selfie_uploaded: boolean | null
          id: string | null
          selfie_url: string | null
          updated_at: string | null
          upload_method: string | null
          user_id: string | null
          verification_notes: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          has_selfie_uploaded?: never
          id?: string | null
          selfie_url?: never
          updated_at?: string | null
          upload_method?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          has_selfie_uploaded?: never
          id?: string | null
          selfie_url?: never
          updated_at?: string | null
          upload_method?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      inspection_qr_public: {
        Row: {
          expires_at: string | null
          generated_at: string | null
          is_active: boolean | null
          qr_code_data: Json | null
          qr_code_hash: string | null
        }
        Insert: {
          expires_at?: string | null
          generated_at?: string | null
          is_active?: boolean | null
          qr_code_data?: Json | null
          qr_code_hash?: string | null
        }
        Update: {
          expires_at?: string | null
          generated_at?: string | null
          is_active?: boolean | null
          qr_code_data?: Json | null
          qr_code_hash?: string | null
        }
        Relationships: []
      }
      profiles_secure: {
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
          cpf_cnpj: string | null
          created_at: string | null
          current_city_name: string | null
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
          farm_name: string | null
          fixed_address: string | null
          full_name: string | null
          id: string | null
          invoice_number: string | null
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
          status: Database["public"]["Enums"]["user_status"] | null
          total_ratings: number | null
          truck_documents_url: string | null
          truck_photo_url: string | null
          updated_at: string | null
          user_id: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string | null
          vehicle_other_type: string | null
          vehicle_specifications: string | null
        }
        Insert: {
          active_mode?: string | null
          address_city?: never
          address_city_id?: string | null
          address_complement?: never
          address_neighborhood?: never
          address_number?: never
          address_proof_url?: never
          address_state?: never
          address_street?: never
          address_zip?: never
          antt_number?: never
          aprovado?: boolean | null
          background_check_status?: string | null
          base_city_id?: string | null
          base_city_name?: string | null
          base_lat?: number | null
          base_lng?: number | null
          base_state?: string | null
          cnh_category?: never
          cnh_expiry_date?: never
          cnh_photo_url?: never
          cnh_url?: never
          cnh_validation_status?: string | null
          contact_phone?: never
          cooperative?: string | null
          cpf_cnpj?: never
          created_at?: string | null
          current_city_name?: string | null
          current_state?: string | null
          document?: never
          document_cpf_url?: never
          document_photo_url?: never
          document_rg_url?: never
          document_validation_status?: string | null
          email?: never
          emergency_contact_name?: never
          emergency_contact_phone?: never
          farm_address?: never
          farm_name?: string | null
          fixed_address?: never
          full_name?: string | null
          id?: string | null
          invoice_number?: never
          license_plate_photo_url?: never
          live_cargo_experience?: boolean | null
          location_enabled?: boolean | null
          metadata?: Json | null
          phone?: never
          profile_photo_url?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: never
          rntrc_validation_status?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          selfie_url?: never
          service_cities?: string[] | null
          service_radius_km?: number | null
          service_regions?: string[] | null
          service_states?: string[] | null
          service_types?: string[] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          total_ratings?: number | null
          truck_documents_url?: never
          truck_photo_url?: never
          updated_at?: string | null
          user_id?: string | null
          validated_at?: string | null
          validated_by?: never
          validation_notes?: string | null
          validation_status?: string | null
          vehicle_other_type?: string | null
          vehicle_specifications?: string | null
        }
        Update: {
          active_mode?: string | null
          address_city?: never
          address_city_id?: string | null
          address_complement?: never
          address_neighborhood?: never
          address_number?: never
          address_proof_url?: never
          address_state?: never
          address_street?: never
          address_zip?: never
          antt_number?: never
          aprovado?: boolean | null
          background_check_status?: string | null
          base_city_id?: string | null
          base_city_name?: string | null
          base_lat?: number | null
          base_lng?: number | null
          base_state?: string | null
          cnh_category?: never
          cnh_expiry_date?: never
          cnh_photo_url?: never
          cnh_url?: never
          cnh_validation_status?: string | null
          contact_phone?: never
          cooperative?: string | null
          cpf_cnpj?: never
          created_at?: string | null
          current_city_name?: string | null
          current_state?: string | null
          document?: never
          document_cpf_url?: never
          document_photo_url?: never
          document_rg_url?: never
          document_validation_status?: string | null
          email?: never
          emergency_contact_name?: never
          emergency_contact_phone?: never
          farm_address?: never
          farm_name?: string | null
          fixed_address?: never
          full_name?: string | null
          id?: string | null
          invoice_number?: never
          license_plate_photo_url?: never
          live_cargo_experience?: boolean | null
          location_enabled?: boolean | null
          metadata?: Json | null
          phone?: never
          profile_photo_url?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: never
          rntrc_validation_status?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          selfie_url?: never
          service_cities?: string[] | null
          service_radius_km?: number | null
          service_regions?: string[] | null
          service_states?: string[] | null
          service_types?: string[] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          total_ratings?: number | null
          truck_documents_url?: never
          truck_photo_url?: never
          updated_at?: string | null
          user_id?: string | null
          validated_at?: string | null
          validated_by?: never
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
        ]
      }
      service_requests_secure: {
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
          contact_phone: string | null
          created_at: string | null
          estimated_price: number | null
          final_price: number | null
          id: string | null
          is_emergency: boolean | null
          location_address: string | null
          location_city: string | null
          location_lat: number | null
          location_lng: number | null
          location_state: string | null
          preferred_datetime: string | null
          problem_description: string | null
          provider_comment: string | null
          provider_id: string | null
          provider_notes: string | null
          provider_rating: number | null
          reference_number: number | null
          service_radius_km: number | null
          service_type: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          urgency: string | null
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
          contact_document?: never
          contact_email?: never
          contact_name?: never
          contact_phone?: never
          created_at?: string | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string | null
          is_emergency?: boolean | null
          location_address?: never
          location_city?: string | null
          location_lat?: never
          location_lng?: never
          location_state?: string | null
          preferred_datetime?: string | null
          problem_description?: string | null
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          reference_number?: number | null
          service_radius_km?: number | null
          service_type?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
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
          contact_document?: never
          contact_email?: never
          contact_name?: never
          contact_phone?: never
          created_at?: string | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string | null
          is_emergency?: boolean | null
          location_address?: never
          location_city?: string | null
          location_lat?: never
          location_lng?: never
          location_state?: string | null
          preferred_datetime?: string | null
          problem_description?: string | null
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          reference_number?: number | null
          service_radius_km?: number | null
          service_type?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
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
            foreignKeyName: "fk_service_requests_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "fk_service_requests_provider"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
        ]
      }
      transport_companies_secure: {
        Row: {
          address: string | null
          antt_document_url: string | null
          antt_registration: string | null
          city: string | null
          cnpj_document_url: string | null
          company_cnpj: string | null
          company_name: string | null
          created_at: string | null
          id: string | null
          municipal_registration: string | null
          profile_id: string | null
          state: string | null
          state_registration: string | null
          status: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          antt_document_url?: never
          antt_registration?: never
          city?: string | null
          cnpj_document_url?: never
          company_cnpj?: never
          company_name?: string | null
          created_at?: string | null
          id?: string | null
          municipal_registration?: never
          profile_id?: string | null
          state?: string | null
          state_registration?: never
          status?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          antt_document_url?: never
          antt_registration?: never
          city?: string | null
          cnpj_document_url?: never
          company_cnpj?: never
          company_name?: string | null
          created_at?: string | null
          id?: string | null
          municipal_registration?: never
          profile_id?: string | null
          state?: string | null
          state_registration?: never
          status?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_companies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_companies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles_secure: {
        Row: {
          assigned_driver_id: string | null
          axle_count: number | null
          company_id: string | null
          created_at: string | null
          crlv_expiry_date: string | null
          crlv_url: string | null
          driver_id: string | null
          high_performance: boolean | null
          id: string | null
          inspection_certificate_url: string | null
          insurance_document_url: string | null
          insurance_expiry_date: string | null
          is_company_vehicle: boolean | null
          last_inspection_date: string | null
          license_plate: string | null
          max_capacity_tons: number | null
          primary_identification: string | null
          status: string | null
          updated_at: string | null
          vehicle_photo_url: string | null
          vehicle_specifications: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_validation_status: string | null
        }
        Insert: {
          assigned_driver_id?: string | null
          axle_count?: number | null
          company_id?: string | null
          created_at?: string | null
          crlv_expiry_date?: string | null
          crlv_url?: never
          driver_id?: string | null
          high_performance?: boolean | null
          id?: string | null
          inspection_certificate_url?: never
          insurance_document_url?: never
          insurance_expiry_date?: string | null
          is_company_vehicle?: boolean | null
          last_inspection_date?: string | null
          license_plate?: never
          max_capacity_tons?: number | null
          primary_identification?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_photo_url?: string | null
          vehicle_specifications?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_validation_status?: string | null
        }
        Update: {
          assigned_driver_id?: string | null
          axle_count?: number | null
          company_id?: string | null
          created_at?: string | null
          crlv_expiry_date?: string | null
          crlv_url?: never
          driver_id?: string | null
          high_performance?: boolean | null
          id?: string | null
          inspection_certificate_url?: never
          insurance_document_url?: never
          insurance_expiry_date?: string | null
          is_company_vehicle?: boolean | null
          last_inspection_date?: string | null
          license_plate?: never
          max_capacity_tons?: number | null
          primary_identification?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_photo_url?: string | null
          vehicle_specifications?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
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
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_match_exposure: {
        Args: { p_item_id: string; p_item_type: string }
        Returns: undefined
      }
      accept_service_proposal: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      accept_service_request: {
        Args: { p_provider_id: string; p_request_id: string }
        Returns: {
          accepted_at: string
          id: string
          provider_id: string
          status: string
        }[]
      }
      assign_freight_to_affiliated_driver: {
        Args: {
          p_driver_profile_id: string
          p_freight_id: string
          p_message?: string
          p_proposed_price: number
        }
        Returns: Json
      }
      assign_service_to_affiliated_driver: {
        Args: { p_driver_profile_id: string; p_service_id: string }
        Returns: Json
      }
      auto_cancel_expired_service_requests: { Args: never; Returns: undefined }
      auto_cancel_overdue_freights: { Args: never; Returns: Json }
      auto_confirm_deliveries: { Args: never; Returns: Json }
      auto_confirm_delivery_and_payments: { Args: never; Returns: undefined }
      auto_confirm_payments_after_72h: { Args: never; Returns: undefined }
      auto_confirm_pending_deliveries: { Args: never; Returns: Json }
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
      calculate_eta_minutes: { Args: { p_freight_id: string }; Returns: number }
      calculate_freight_antifraud_score: {
        Args: { p_freight_id: string }
        Returns: {
          deviation_km: number
          high_risk_stops: number
          level: string
          offline_minutes: number
          score: number
          stop_time_minutes: number
          stops_count: number
        }[]
      }
      calculate_freight_eta: {
        Args: {
          p_current_lat: number
          p_current_lng: number
          p_current_speed_kmh?: number
          p_freight_id: string
        }
        Returns: Json
      }
      calculate_freight_risk_score: {
        Args: { p_freight_id: string }
        Returns: number
      }
      can_driver_update_freight_location: {
        Args: { p_freight_id: string }
        Returns: boolean
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
      can_view_vehicle_via_freight: {
        Args: { vehicle_driver_id: string }
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
      cancel_producer_service_request: {
        Args: { p_cancellation_reason?: string; p_request_id: string }
        Returns: Json
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
      check_interstate_transit_rules: {
        Args: {
          p_destination_uf: string
          p_origin_uf: string
          p_species?: string
        }
        Returns: Json
      }
      check_livestock_compliance: {
        Args: { p_freight_id: string }
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
      classify_stop: {
        Args: { p_duration_minutes: number; p_is_authorized: boolean }
        Returns: string
      }
      clean_expired_zip_cache: { Args: never; Returns: undefined }
      cleanup_expired_requests: { Args: never; Returns: undefined }
      cleanup_match_debug_logs: { Args: never; Returns: number }
      cleanup_match_interactions: { Args: never; Returns: number }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      cleanup_old_location_history: { Args: never; Returns: Json }
      cleanup_rate_limits: { Args: never; Returns: number }
      clear_expired_exposures: { Args: never; Returns: number }
      confirm_checkin_as_counterpart: {
        Args: { p_checkin_id: string; p_observations?: string }
        Returns: boolean
      }
      confirm_delivery: { Args: { freight_id_param: string }; Returns: Json }
      confirm_delivery_individual: {
        Args: { p_assignment_id: string; p_notes?: string }
        Returns: Json
      }
      confirm_emission_credit: {
        Args: { p_emission_id: string }
        Returns: boolean
      }
      confirm_service_delivery: {
        Args: { p_notes?: string; p_service_request_id: string }
        Returns: Json
      }
      confirm_service_payment_receipt: {
        Args: { p_service_request_id: string }
        Returns: Json
      }
      create_additional_profile: {
        Args: {
          p_document?: string
          p_full_name?: string
          p_phone?: string
          p_role: string
          p_user_id: string
        }
        Returns: Json
      }
      current_profile_id: { Args: never; Returns: string }
      decrypt_document: {
        Args: { encrypted_doc: string; original_doc: string }
        Returns: string
      }
      decrypt_pii_field: { Args: { p_encrypted: string }; Returns: string }
      decrypt_sensitive_data:
        | { Args: { data: string; key: string }; Returns: string }
        | { Args: { encrypted_data: string }; Returns: string }
      detect_eta_worsening: {
        Args: { p_freight_id: string; p_threshold_minutes?: number }
        Returns: boolean
      }
      detect_freight_delay_alerts: {
        Args: { p_freight_id: string }
        Returns: Json
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
      dismiss_match_exposure: {
        Args: { p_item_id: string; p_item_type: string }
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
      edge_function_rate_check: {
        Args: {
          p_endpoint: string
          p_ip_address: unknown
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      encrypt_document: { Args: { doc: string }; Returns: string }
      encrypt_pii_field: { Args: { p_value: string }; Returns: string }
      encrypt_sensitive_data:
        | { Args: { data: string }; Returns: string }
        | { Args: { data: string; key: string }; Returns: string }
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
      expire_livestock_compliance: { Args: never; Returns: number }
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
            Args: { freight_uuid: string }
            Returns: {
              distance_m: number
              driver_area_id: string
              driver_id: string
              match_method: string
              radius_km: number
            }[]
          }
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
      find_drivers_by_route:
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
      find_duplicate_documents: {
        Args: never
        Returns: {
          count: number
          document_number: string
          profile_ids: string[]
        }[]
      }
      find_duplicate_emails: {
        Args: never
        Returns: {
          count: number
          email_address: string
          profile_ids: string[]
        }[]
      }
      find_duplicate_phones: {
        Args: never
        Returns: {
          count: number
          phone_number: string
          profile_ids: string[]
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
      finish_match_debug: {
        Args: {
          p_error?: string
          p_request_id: string
          p_sample?: Json
          p_stats?: Json
        }
        Returns: undefined
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
      get_admin_role: { Args: never; Returns: string }
      get_affiliated_driver_profile: {
        Args: { p_company_id: string; p_driver_profile_id: string }
        Returns: {
          address_city: string
          address_complement: string
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          address_zip: string
          can_accept_freights: boolean
          can_manage_vehicles: boolean
          cnh_category: string
          cnh_expiry_date: string
          cnh_photo_url: string
          cnh_validation_status: string
          contact_phone: string
          cpf_cnpj: string
          created_at: string
          document_validation_status: string
          email: string
          full_name: string
          id: string
          phone: string
          profile_photo_url: string
          rating: number
          rntrc: string
          role: string
          selfie_url: string
          status: string
          total_ratings: number
        }[]
      }
      get_authoritative_feed: {
        Args: {
          p_debug?: boolean
          p_expiry_bucket?: string
          p_role?: string
          p_sort?: string
          p_types?: string[]
          p_user_id?: string
        }
        Returns: Json
      }
      get_company_owner_for_affiliated_driver: {
        Args: { p_company_id: string }
        Returns: {
          owner_email: string
          owner_name: string
          owner_phone: string
          owner_profile_id: string
        }[]
      }
      get_company_report_charts: {
        Args: { p_company_id: string; p_end_at: string; p_start_at: string }
        Returns: Json
      }
      get_company_report_summary: {
        Args: { p_company_id: string; p_end_at: string; p_start_at: string }
        Returns: Json
      }
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
      get_compliance_kpis: { Args: { p_empresa_id?: string }; Returns: Json }
      get_current_profile_id: { Args: never; Returns: string }
      get_current_user_safe: { Args: never; Returns: string }
      get_driver_report_charts:
        | {
            Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
            Returns: Json
          }
        | {
            Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
            Returns: Json
          }
      get_driver_report_summary:
        | {
            Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
            Returns: Json
          }
        | {
            Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
            Returns: Json
          }
      get_email_by_document: { Args: { p_doc: string }; Returns: string }
      get_failed_login_attempts: {
        Args: { min_failures?: number; since_timestamp: string }
        Returns: {
          email: string
          failed_count: number
          ip_addresses: string[]
        }[]
      }
      get_fiscalizacao_data: { Args: { p_placa: string }; Returns: Json }
      get_freight_trip_progress_overview: {
        Args: { p_only_active?: boolean }
        Returns: {
          accepted_trucks: number
          assignments: Json
          freight_id: string
          freight_status: string
          last_history_at: string
          required_trucks: number
          updated_at: string
        }[]
      }
      get_freights_for_driver: {
        Args: { p_driver_id: string }
        Returns: {
          accepted_trucks: number
          cargo_type: string
          created_at: string
          delivery_date: string
          destination_address: string
          destination_city: string
          destination_state: string
          distance_km: number
          distance_to_origin_km: number
          id: string
          minimum_antt_price: number
          origin_address: string
          origin_city: string
          origin_city_id: string
          origin_state: string
          pickup_date: string
          price: number
          price_per_km: number
          pricing_type: string
          required_trucks: number
          service_type: string
          status: string
          urgency: string
          vehicle_axles_required: number
          vehicle_type_required: string
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
      get_item_expiration_info: {
        Args: { p_item_id: string; p_item_type?: string }
        Returns: {
          can_auto_cancel: boolean
          created_at: string
          expiration_hours: number
          expires_at: string
          is_expired: boolean
          item_id: string
          item_type: string
          service_type: string
          status: string
          time_remaining: unknown
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
      get_my_profile_id: { Args: never; Returns: string }
      get_my_profile_id_for_pii: { Args: never; Returns: string }
      get_my_profile_ids: { Args: never; Returns: string[] }
      get_my_transport_company_ids: { Args: never; Returns: string[] }
      get_my_trip_progress: { Args: { p_freight_id?: string }; Returns: Json }
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
      get_operation_report: {
        Args: {
          p_end_date?: string
          p_entity_type?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_own_profile_id: { Args: { p_user_id: string }; Returns: string }
      get_participant_freight_count: {
        Args: { p_user_id: string; p_user_type?: string }
        Returns: number
      }
      get_pending_ratings_with_affiliation: {
        Args: { p_profile_id: string }
        Returns: {
          assignment_id: string
          company_id: string
          company_name: string
          driver_id: string
          driver_name: string
          freight_id: string
          payment_confirmed_at: string
          pending_types: string[]
          producer_id: string
          producer_name: string
        }[]
      }
      get_platform_stats: {
        Args: never
        Returns: {
          avaliacao_media: number
          fretes_entregues: number
          motoristas: number
          peso_total: number
          prestadores: number
          produtores: number
          total_fretes: number
          total_usuarios: number
        }[]
      }
      get_producer_report_charts: {
        Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
        Returns: Json
      }
      get_producer_report_summary: {
        Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
        Returns: Json
      }
      get_provider_report_charts: {
        Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
        Returns: Json
      }
      get_provider_report_summary: {
        Args: { p_end_at: string; p_profile_id: string; p_start_at: string }
        Returns: Json
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
      get_reports_dashboard: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_filters?: Json
          p_panel: string
          p_profile_id: string
        }
        Returns: Json
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
      get_unified_freight_feed: {
        Args: {
          p_company_id?: string
          p_date?: string
          p_debug?: boolean
          p_panel: string
          p_profile_id: string
        }
        Returns: Json
      }
      get_unified_service_feed: {
        Args: { p_debug?: boolean; p_profile_id: string }
        Returns: Json
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
      get_user_interaction_summary: {
        Args: { p_days?: number; p_user_id: string }
        Returns: Json
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
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
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
      haversine_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      insert_driver_location_history: {
        Args: {
          p_accuracy?: number
          p_driver_profile_id: string
          p_freight_id: string
          p_heading?: number
          p_lat: number
          p_lng: number
          p_speed?: number
        }
        Returns: string
      }
      insert_route_point: {
        Args: {
          p_accuracy?: number
          p_freight_id: string
          p_heading?: number
          p_lat: number
          p_lng: number
          p_speed?: number
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_affiliated_driver: { Args: { p_profile_id: string }; Returns: boolean }
      is_affiliated_driver_of_my_company: {
        Args: { p_driver_profile_id: string }
        Returns: boolean
      }
      is_allowlisted_admin: { Args: never; Returns: boolean }
      is_antifraud_viewer: { Args: { _user_id: string }; Returns: boolean }
      is_company_driver: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      is_company_owner: { Args: { p_company_id: string }; Returns: boolean }
      is_company_owner_of_driver_storage: {
        Args: { file_name: string }
        Returns: boolean
      }
      is_current_user_producer_of_freight: {
        Args: { p_freight_id: string }
        Returns: boolean
      }
      is_driver_assigned_to_freight: {
        Args: { p_freight_id: string }
        Returns: boolean
      }
      is_driver_of_assignment: {
        Args: { p_driver_id: string }
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
      is_freight_participant: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      is_freight_participant_for_rating: {
        Args: { p_freight_id: string; p_user_id: string }
        Returns: boolean
      }
      is_freight_payment_confirmed: {
        Args: { p_freight_id: string }
        Returns: boolean
      }
      is_ip_blacklisted: { Args: { check_ip: unknown }; Returns: boolean }
      is_producer_of_freight: {
        Args: { p_freight_id: string }
        Returns: boolean
      }
      is_profile_owner: {
        Args: { _profile_id: string; _viewer: string }
        Returns: boolean
      }
      is_service_compatible: {
        Args: { driver_service_types: string[]; freight_service_type: string }
        Returns: boolean
      }
      is_service_participant: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      is_service_role: { Args: never; Returns: boolean }
      is_transport_company: { Args: { p_user_id: string }; Returns: boolean }
      is_trusted_entity: {
        Args: { p_entity_type: string; p_entity_value: string }
        Returns: boolean
      }
      log_compliance_event: {
        Args: {
          p_event_category: string
          p_event_data?: Json
          p_event_type: string
          p_freight_id: string
          p_livestock_compliance_id: string
          p_new_state?: Json
          p_previous_state?: Json
        }
        Returns: string
      }
      log_inspection_access: {
        Args: {
          p_access_granted?: boolean
          p_denial_reason?: string
          p_ip_address?: unknown
          p_qr_code_hash: string
          p_user_agent?: string
        }
        Returns: string
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
            Args: {
              access_type: string
              accessed_id: string
              accessed_table: string
            }
            Returns: undefined
          }
        | {
            Args: { access_type: string; request_id: string }
            Returns: undefined
          }
      log_trip_progress_event: {
        Args: {
          p_driver_profile_id: string
          p_error_code?: string
          p_error_message?: string
          p_execution_ms?: number
          p_freight_id: string
          p_meta?: Json
          p_new_status: string
          p_old_status: string
          p_success: boolean
        }
        Returns: undefined
      }
      mark_freight_messages_as_read: {
        Args: { p_freight_id: string }
        Returns: undefined
      }
      mark_history_rating_completed: {
        Args: { p_original_id: string; p_user_id: string }
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
      migrate_profile_to_encrypted: { Args: { p_id: string }; Returns: boolean }
      normalize_service_type_canonical: {
        Args: { p_type: string }
        Returns: string
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
      purge_expired_driver_locations: { Args: never; Returns: number }
      register_match_exposure: {
        Args: {
          p_city_id?: string
          p_distance_km?: number
          p_item_id: string
          p_item_type: string
          p_ttl_minutes?: number
        }
        Returns: {
          city_id: string | null
          distance_km: number | null
          expires_at: string
          first_seen_at: string
          id: string
          item_id: string
          item_type: string
          last_seen_at: string
          meta: Json
          score: number | null
          seen_count: number
          status: string
          viewer_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "match_exposures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_match_exposures_batch: {
        Args: { p_items: Json; p_ttl_minutes?: number }
        Returns: number
      }
      reject_service_proposal: {
        Args: {
          p_proposal_id: string
          p_rejection_reason?: string
          p_return_to_open?: boolean
        }
        Returns: Json
      }
      release_emission_credit: {
        Args: { p_emission_id: string }
        Returns: boolean
      }
      reopen_freight: { Args: { p_freight_id: string }; Returns: string }
      reserve_emission_credit: {
        Args: { p_emission_id: string; p_issuer_id: string }
        Returns: boolean
      }
      run_antifraud_rules: {
        Args: { p_freight_id: string }
        Returns: {
          alerts_created: number
          risk_score: number
        }[]
      }
      run_compliance_expiry_check: { Args: never; Returns: Json }
      sanitize_document: { Args: { doc: string }; Returns: string }
      save_freight_completion_snapshot: {
        Args: {
          p_delivery_confirmed_by?: string
          p_freight_id: string
          p_payment_confirmed_by_driver_at?: string
          p_payment_confirmed_by_producer_at?: string
        }
        Returns: Json
      }
      save_zip_to_cache: {
        Args: {
          p_city_id?: string
          p_city_name: string
          p_lat?: number
          p_lng?: number
          p_neighborhood?: string
          p_source?: string
          p_state: string
          p_street?: string
          p_zip_code: string
        }
        Returns: undefined
      }
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
      search_city_by_zip: {
        Args: { p_zip_code: string }
        Returns: {
          city_id: string
          city_name: string
          from_cache: boolean
          lat: number
          lng: number
          neighborhood: string
          source: string
          state: string
          street: string
        }[]
      }
      send_location_to_freight_chats: { Args: never; Returns: Json }
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
      start_match_debug: {
        Args: { p_feed_type: string; p_filters?: Json }
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
      transition_service_request_status: {
        Args: {
          p_final_price?: number
          p_next_status: string
          p_request_id: string
        }
        Returns: Json
      }
      trigger_cte_polling: { Args: never; Returns: undefined }
      trigger_mdfe_polling: { Args: never; Returns: undefined }
      update_freight_status: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["freight_status"]
        }
        Returns: {
          accepted_by_company: boolean | null
          accepted_trucks: number
          allow_counter_proposals: boolean | null
          antifraud_analyzed_at: string | null
          antifraud_level: string | null
          antifraud_score: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cargo_category: string | null
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
          delay_alert_status: string | null
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_city: string | null
          destination_city_id: string | null
          destination_complement: string | null
          destination_geog: unknown
          destination_lat: number | null
          destination_lng: number | null
          destination_neighborhood: string | null
          destination_number: string | null
          destination_state: string | null
          destination_street: string | null
          destination_zip_code: string | null
          distance_km: number | null
          distance_source: string | null
          distancia_km_manual: number | null
          driver_id: string | null
          drivers_assigned: string[] | null
          estimated_arrival_at: string | null
          eta_average_speed_kmh: number | null
          eta_calculated_at: string | null
          eta_remaining_distance_km: number | null
          expires_at: string | null
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
          last_eta_minutes: number | null
          last_location_update: string | null
          metadata: Json | null
          min_driver_rating: number | null
          minimum_antt_price: number | null
          offline_minutes: number | null
          origin_address: string
          origin_city: string | null
          origin_city_id: string | null
          origin_complement: string | null
          origin_geog: unknown
          origin_lat: number | null
          origin_lng: number | null
          origin_neighborhood: string | null
          origin_number: string | null
          origin_state: string | null
          origin_street: string | null
          origin_zip_code: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          price_per_km: number | null
          pricing_type: string
          problem_description: string | null
          producer_id: string | null
          prospect_user_id: string | null
          reference_number: number | null
          region_code: string | null
          required_trucks: number
          requires_sanitary_docs: boolean | null
          risk_score: number | null
          route_deviation_max_km: number | null
          route_geom: unknown
          route_waypoints: Json | null
          sanitary_compliance_status: string | null
          scheduled_date: string | null
          service_radius_km: number | null
          service_type: string | null
          show_contact_after_accept: boolean | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          total_distance_km: number | null
          total_duration_minutes: number | null
          total_offline_time_minutes: number | null
          total_stop_minutes: number | null
          total_stop_time_minutes: number | null
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
          visibility_type: string | null
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
          antifraud_analyzed_at: string | null
          antifraud_level: string | null
          antifraud_score: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cargo_category: string | null
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
          delay_alert_status: string | null
          delivery_date: string
          delivery_observations: string | null
          description: string | null
          destination_address: string
          destination_city: string | null
          destination_city_id: string | null
          destination_complement: string | null
          destination_geog: unknown
          destination_lat: number | null
          destination_lng: number | null
          destination_neighborhood: string | null
          destination_number: string | null
          destination_state: string | null
          destination_street: string | null
          destination_zip_code: string | null
          distance_km: number | null
          distance_source: string | null
          distancia_km_manual: number | null
          driver_id: string | null
          drivers_assigned: string[] | null
          estimated_arrival_at: string | null
          eta_average_speed_kmh: number | null
          eta_calculated_at: string | null
          eta_remaining_distance_km: number | null
          expires_at: string | null
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
          last_eta_minutes: number | null
          last_location_update: string | null
          metadata: Json | null
          min_driver_rating: number | null
          minimum_antt_price: number | null
          offline_minutes: number | null
          origin_address: string
          origin_city: string | null
          origin_city_id: string | null
          origin_complement: string | null
          origin_geog: unknown
          origin_lat: number | null
          origin_lng: number | null
          origin_neighborhood: string | null
          origin_number: string | null
          origin_state: string | null
          origin_street: string | null
          origin_zip_code: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          price_per_km: number | null
          pricing_type: string
          problem_description: string | null
          producer_id: string | null
          prospect_user_id: string | null
          reference_number: number | null
          region_code: string | null
          required_trucks: number
          requires_sanitary_docs: boolean | null
          risk_score: number | null
          route_deviation_max_km: number | null
          route_geom: unknown
          route_waypoints: Json | null
          sanitary_compliance_status: string | null
          scheduled_date: string | null
          service_radius_km: number | null
          service_type: string | null
          show_contact_after_accept: boolean | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          total_distance_km: number | null
          total_duration_minutes: number | null
          total_offline_time_minutes: number | null
          total_stop_minutes: number | null
          total_stop_time_minutes: number | null
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
          visibility_type: string | null
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
      update_producer_service_request: {
        Args: {
          p_additional_info?: string
          p_contact_email?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_location_address?: string
          p_problem_description?: string
          p_request_id: string
          p_urgency?: string
        }
        Returns: Json
      }
      update_trip_progress: {
        Args: {
          p_freight_id: string
          p_lat?: number
          p_lng?: number
          p_new_status: string
          p_notes?: string
        }
        Returns: Json
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
      app_role:
        | "admin"
        | "driver"
        | "producer"
        | "service_provider"
        | "carrier"
        | "affiliated_driver"
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
      livestock_species_enum:
        | "bovinos"
        | "suinos"
        | "equinos"
        | "caprinos"
        | "ovinos"
        | "aves"
        | "outros"
      mdfe_documento_tipo: "NFE" | "CTE" | "NFCE"
      mdfe_emitter_type: "PRODUCER" | "DRIVER" | "COMPANY"
      mdfe_modo_emissao: "NORMAL" | "CONTINGENCIA_FSDA"
      mdfe_status:
        | "PENDENTE"
        | "AUTORIZADO"
        | "ENCERRADO"
        | "CANCELADO"
        | "CONTINGENCIA"
        | "PROCESSANDO"
        | "PROCESSANDO_ENCERRAMENTO"
        | "PROCESSANDO_CANCELAMENTO"
        | "REJEITADO"
      mdfe_tipo_proprietario: "PROPRIO" | "TERCEIRO"
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
      sanitary_compliance_status_enum:
        | "PENDING"
        | "COMPLIANT"
        | "NON_COMPLIANT"
        | "EXPIRED"
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
        | "CARRETA_GADO"
        | "CARRETA_REFRIGERADA"
        | "PRANCHA"
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
      app_role: [
        "admin",
        "driver",
        "producer",
        "service_provider",
        "carrier",
        "affiliated_driver",
      ],
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
      livestock_species_enum: [
        "bovinos",
        "suinos",
        "equinos",
        "caprinos",
        "ovinos",
        "aves",
        "outros",
      ],
      mdfe_documento_tipo: ["NFE", "CTE", "NFCE"],
      mdfe_emitter_type: ["PRODUCER", "DRIVER", "COMPANY"],
      mdfe_modo_emissao: ["NORMAL", "CONTINGENCIA_FSDA"],
      mdfe_status: [
        "PENDENTE",
        "AUTORIZADO",
        "ENCERRADO",
        "CANCELADO",
        "CONTINGENCIA",
        "PROCESSANDO",
        "PROCESSANDO_ENCERRAMENTO",
        "PROCESSANDO_CANCELAMENTO",
        "REJEITADO",
      ],
      mdfe_tipo_proprietario: ["PROPRIO", "TERCEIRO"],
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
      sanitary_compliance_status_enum: [
        "PENDING",
        "COMPLIANT",
        "NON_COMPLIANT",
        "EXPIRED",
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
        "CARRETA_GADO",
        "CARRETA_REFRIGERADA",
        "PRANCHA",
      ],
    },
  },
} as const
