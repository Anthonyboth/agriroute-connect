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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          geom: unknown | null
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          radius_km: number
          radius_m: number | null
          service_area: unknown | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city_name: string
          created_at?: string | null
          driver_id: string
          geom?: unknown | null
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city_name?: string
          created_at?: string | null
          driver_id?: string
          geom?: unknown | null
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown | null
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          driver_area_id: string
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
          driver_area_id: string
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
          driver_area_id?: string
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
          accepted_trucks: number
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
          destination_geog: unknown | null
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          extra_fees: number | null
          extra_fees_description: string | null
          fiscal_documents_url: string | null
          flexible_dates: boolean | null
          id: string
          is_scheduled: boolean | null
          last_location_update: string | null
          metadata: Json | null
          minimum_antt_price: number | null
          origin_address: string
          origin_geog: unknown | null
          origin_lat: number | null
          origin_lng: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations: string | null
          price: number
          price_per_km: number | null
          producer_id: string
          required_trucks: number
          route_geom: unknown | null
          route_waypoints: Json | null
          scheduled_date: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["freight_status"]
          toll_cost: number | null
          tracking_ended_at: string | null
          tracking_required: boolean | null
          tracking_started_at: string | null
          tracking_status: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          vehicle_type_required:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          weight: number
        }
        Insert: {
          accepted_trucks?: number
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
          destination_geog?: unknown | null
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          extra_fees?: number | null
          extra_fees_description?: string | null
          fiscal_documents_url?: string | null
          flexible_dates?: boolean | null
          id?: string
          is_scheduled?: boolean | null
          last_location_update?: string | null
          metadata?: Json | null
          minimum_antt_price?: number | null
          origin_address: string
          origin_geog?: unknown | null
          origin_lat?: number | null
          origin_lng?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date: string
          pickup_observations?: string | null
          price: number
          price_per_km?: number | null
          producer_id: string
          required_trucks?: number
          route_geom?: unknown | null
          route_waypoints?: Json | null
          scheduled_date?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          tracking_ended_at?: string | null
          tracking_required?: boolean | null
          tracking_started_at?: string | null
          tracking_status?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          vehicle_type_required?:
            | Database["public"]["Enums"]["vehicle_type"]
            | null
          weight: number
        }
        Update: {
          accepted_trucks?: number
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
          destination_geog?: unknown | null
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          extra_fees?: number | null
          extra_fees_description?: string | null
          fiscal_documents_url?: string | null
          flexible_dates?: boolean | null
          id?: string
          is_scheduled?: boolean | null
          last_location_update?: string | null
          metadata?: Json | null
          minimum_antt_price?: number | null
          origin_address?: string
          origin_geog?: unknown | null
          origin_lat?: number | null
          origin_lng?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_date?: string
          pickup_observations?: string | null
          price?: number
          price_per_km?: number | null
          producer_id?: string
          required_trucks?: number
          route_geom?: unknown | null
          route_waypoints?: Json | null
          scheduled_date?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["freight_status"]
          toll_cost?: number | null
          tracking_ended_at?: string | null
          tracking_required?: boolean | null
          tracking_started_at?: string | null
          tracking_status?: string | null
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
      guest_requests: {
        Row: {
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          payload: Json
          provider_id: string | null
          request_type: string
          service_type: string | null
          status: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          payload: Json
          provider_id?: string | null
          request_type: string
          service_type?: string | null
          status?: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          payload?: Json
          provider_id?: string | null
          request_type?: string
          service_type?: string | null
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
      profiles: {
        Row: {
          address_proof_url: string | null
          antt_number: string | null
          aprovado: boolean | null
          background_check_status: string | null
          cnh_category: string | null
          cnh_expiry_date: string | null
          cnh_photo_url: string | null
          cnh_url: string | null
          cnh_validation_status: string | null
          contact_phone: string | null
          cooperative: string | null
          cpf_cnpj: string
          created_at: string
          current_location_lat: number | null
          current_location_lng: number | null
          document: string | null
          document_cpf_url: string | null
          document_photo_url: string | null
          document_rg_url: string | null
          document_validation_status: string | null
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
          phone: string | null
          profile_photo_url: string | null
          rating: number | null
          rating_locked: boolean | null
          rating_sum: number | null
          rntrc: string | null
          rntrc_validation_status: string | null
          role: Database["public"]["Enums"]["user_role"]
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
          address_proof_url?: string | null
          antt_number?: string | null
          aprovado?: boolean | null
          background_check_status?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_photo_url?: string | null
          cnh_url?: string | null
          cnh_validation_status?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj: string
          created_at?: string
          current_location_lat?: number | null
          current_location_lng?: number | null
          document?: string | null
          document_cpf_url?: string | null
          document_photo_url?: string | null
          document_rg_url?: string | null
          document_validation_status?: string | null
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
          phone?: string | null
          profile_photo_url?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: string | null
          rntrc_validation_status?: string | null
          role: Database["public"]["Enums"]["user_role"]
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
          address_proof_url?: string | null
          antt_number?: string | null
          aprovado?: boolean | null
          background_check_status?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_photo_url?: string | null
          cnh_url?: string | null
          cnh_validation_status?: string | null
          contact_phone?: string | null
          cooperative?: string | null
          cpf_cnpj?: string
          created_at?: string
          current_location_lat?: number | null
          current_location_lng?: number | null
          document?: string | null
          document_cpf_url?: string | null
          document_photo_url?: string | null
          document_rg_url?: string | null
          document_validation_status?: string | null
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
          phone?: string | null
          profile_photo_url?: string | null
          rating?: number | null
          rating_locked?: boolean | null
          rating_sum?: number | null
          rntrc?: string | null
          rntrc_validation_status?: string | null
          role?: Database["public"]["Enums"]["user_role"]
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
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          ip_address: unknown | null
          request_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          access_type?: string | null
          accessed_at?: string | null
          id?: string
          ip_address?: unknown | null
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          access_type?: string | null
          accessed_at?: string | null
          id?: string
          ip_address?: unknown | null
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
      service_provider_areas: {
        Row: {
          city_name: string
          created_at: string | null
          geom: unknown | null
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          provider_id: string
          radius_km: number
          radius_m: number | null
          service_area: unknown | null
          service_types: string[] | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city_name: string
          created_at?: string | null
          geom?: unknown | null
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          provider_id: string
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown | null
          service_types?: string[] | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city_name?: string
          created_at?: string | null
          geom?: unknown | null
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          provider_id?: string
          radius_km?: number
          radius_m?: number | null
          service_area?: unknown | null
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
      service_requests: {
        Row: {
          accepted_at: string | null
          additional_info: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_comment: string | null
          client_id: string
          client_rating: number | null
          completed_at: string | null
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
          location_lat: number | null
          location_lng: number | null
          preferred_datetime: string | null
          problem_description: string
          provider_comment: string | null
          provider_id: string | null
          provider_notes: string | null
          provider_rating: number | null
          service_type: string
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
          client_comment?: string | null
          client_id: string
          client_rating?: number | null
          completed_at?: string | null
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
          location_lat?: number | null
          location_lng?: number | null
          preferred_datetime?: string | null
          problem_description: string
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          service_type: string
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
          client_comment?: string | null
          client_id?: string
          client_rating?: number | null
          completed_at?: string | null
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
          location_lat?: number | null
          location_lng?: number | null
          preferred_datetime?: string | null
          problem_description?: string
          provider_comment?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          provider_rating?: number | null
          service_type?: string
          status?: string
          updated_at?: string
          urgency?: string
          vehicle_info?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
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
      tracking_consents: {
        Row: {
          consent_given: boolean
          consent_text: string
          created_at: string
          freight_id: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_given?: boolean
          consent_text: string
          created_at?: string
          freight_id: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_given?: boolean
          consent_text?: string
          created_at?: string
          freight_id?: string
          id?: string
          ip_address?: unknown | null
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
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown | null
          f_table_catalog: unknown | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown | null
          f_table_catalog: string | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_scripts_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_bestsrid: {
        Args: { "": unknown }
        Returns: number
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_pointoutside: {
        Args: { "": unknown }
        Returns: unknown
      }
      _st_sortablehash: {
        Args: { geom: unknown }
        Returns: number
      }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      addauth: {
        Args: { "": string }
        Returns: boolean
      }
      addgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
        Returns: string
      }
      auto_confirm_deliveries: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      box: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box3d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3dtobox: {
        Args: { "": unknown }
        Returns: unknown
      }
      bytea: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      can_notify_driver: {
        Args: { p_driver_id: string }
        Returns: boolean
      }
      can_notify_provider: {
        Args: { p_provider_id: string }
        Returns: boolean
      }
      check_expired_documents: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_low_ratings: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          endpoint_name: string
          max_requests?: number
          time_window?: unknown
        }
        Returns: boolean
      }
      cleanup_expired_requests: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      confirm_checkin_as_counterpart: {
        Args: { p_checkin_id: string; p_observations?: string }
        Returns: boolean
      }
      confirm_delivery: {
        Args: { freight_id_param: string }
        Returns: Json
      }
      create_additional_profile: {
        Args: {
          p_document?: string
          p_full_name?: string
          p_phone?: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: string
      }
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
      disablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      dropgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
          | { column_name: string; schema_name: string; table_name: string }
          | { column_name: string; table_name: string }
        Returns: string
      }
      dropgeometrytable: {
        Args:
          | { catalog_name: string; schema_name: string; table_name: string }
          | { schema_name: string; table_name: string }
          | { table_name: string }
        Returns: string
      }
      enablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      encrypt_document: {
        Args: { doc: string }
        Returns: string
      }
      encrypt_sensitive_data: {
        Args: { data: string; key?: string }
        Returns: string
      }
      equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
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
      find_drivers_by_origin: {
        Args: { freight_uuid: string }
        Returns: {
          city_name: string
          distance_m: number
          driver_area_id: string
          driver_id: string
          radius_km: number
        }[]
      }
      find_drivers_by_route: {
        Args: { freight_uuid: string }
        Returns: {
          city_name: string
          distance_to_route_m: number
          driver_area_id: string
          driver_id: string
          radius_km: number
        }[]
      }
      find_providers_by_location: {
        Args: { request_id: string; request_lat: number; request_lng: number }
        Returns: {
          city_name: string
          distance_m: number
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
      generate_admin_report: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_report_type: string
        }
        Returns: string
      }
      geography: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      geography_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geography_gist_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_gist_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_send: {
        Args: { "": unknown }
        Returns: string
      }
      geography_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geography_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry: {
        Args:
          | { "": string }
          | { "": string }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
        Returns: unknown
      }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_sortsupport_2d: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_hash: {
        Args: { "": unknown }
        Returns: number
      }
      geometry_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_recv: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_send: {
        Args: { "": unknown }
        Returns: string
      }
      geometry_sortsupport: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_spgist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_3d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geometry_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometrytype: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      get_compatible_freights_for_driver: {
        Args: { p_driver_id: string }
        Returns: {
          accepted_trucks: number
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
          required_trucks: number
          service_type: string
          status: string
          urgency: string
          weight: number
        }[]
      }
      get_current_user_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_platform_stats: {
        Args: Record<PropertyKey, never>
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
      get_proj4_from_srid: {
        Args: { "": number }
        Returns: string
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
      get_public_service_requests: {
        Args: Record<PropertyKey, never>
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
        Args: Record<PropertyKey, never>
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
      get_secure_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      gettransactionid: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      gidx_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gidx_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_freight_owner: {
        Args: { freight_id: string; user_profile_id: string }
        Returns: boolean
      }
      is_ip_blacklisted: {
        Args: { check_ip: unknown }
        Returns: boolean
      }
      is_service_compatible: {
        Args: { driver_service_types: string[]; freight_service_type: string }
        Returns: boolean
      }
      json: {
        Args: { "": unknown }
        Returns: Json
      }
      jsonb: {
        Args: { "": unknown }
        Returns: Json
      }
      log_sensitive_data_access: {
        Args:
          | { access_type: string; accessed_id: string; accessed_table: string }
          | { access_type: string; request_id: string }
        Returns: undefined
      }
      longtransactionsenabled: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      path: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_asflatgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_geometry_clusterintersecting_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_clusterwithin_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_collect_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_makeline_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_polygonize_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      point: {
        Args: { "": unknown }
        Returns: unknown
      }
      polygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      populate_geometry_columns: {
        Args:
          | { tbl_oid: unknown; use_typmod?: boolean }
          | { use_typmod?: boolean }
        Returns: number
      }
      postgis_addbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_dropbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_extensions_upgrade: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_full_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_geos_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_geos_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_getbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_hasbbox: {
        Args: { "": unknown }
        Returns: boolean
      }
      postgis_index_supportfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_lib_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_revision: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libjson_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_liblwgeom_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libprotobuf_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libxml_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_proj_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_installed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_released: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_svn_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_typmod_dims: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_srid: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_type: {
        Args: { "": number }
        Returns: string
      }
      postgis_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_wagyu_version: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      spheroid_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      spheroid_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlength: {
        Args: { "": unknown }
        Returns: number
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dperimeter: {
        Args: { "": unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle: {
        Args:
          | { line1: unknown; line2: unknown }
          | { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
        Returns: number
      }
      st_area: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_area2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_asbinary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_asewkt: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asgeojson: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; options?: number }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
          | {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
        Returns: string
      }
      st_asgml: {
        Args:
          | { "": string }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_ashexewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_askml: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
          | { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
        Returns: string
      }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: {
        Args: { format?: string; geom: unknown }
        Returns: string
      }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; rel?: number }
          | { geom: unknown; maxdecimaldigits?: number; rel?: number }
        Returns: string
      }
      st_astext: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_astwkb: {
        Args:
          | {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
          | {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
        Returns: string
      }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_boundary: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer: {
        Args:
          | { geom: unknown; options?: string; radius: number }
          | { geom: unknown; quadsegs: number; radius: number }
        Returns: unknown
      }
      st_buildarea: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_centroid: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      st_cleangeometry: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_clusterintersecting: {
        Args: { "": unknown[] }
        Returns: unknown[]
      }
      st_collect: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collectionextract: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_collectionhomogenize: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_convexhull: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_coorddim: {
        Args: { geometry: unknown }
        Returns: number
      }
      st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_dimension: {
        Args: { "": unknown }
        Returns: number
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance: {
        Args:
          | { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_distancesphere: {
        Args:
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; radius: number }
        Returns: number
      }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dump: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumppoints: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumprings: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumpsegments: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_endpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_envelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_expand: {
        Args:
          | { box: unknown; dx: number; dy: number }
          | { box: unknown; dx: number; dy: number; dz?: number }
          | { dm?: number; dx: number; dy: number; dz?: number; geom: unknown }
        Returns: unknown
      }
      st_exteriorring: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_flipcoordinates: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force3d: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_forcecollection: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcecurve: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygonccw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygoncw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcerhr: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcesfs: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_generatepoints: {
        Args:
          | { area: unknown; npoints: number }
          | { area: unknown; npoints: number; seed: number }
        Returns: unknown
      }
      st_geogfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geogfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geographyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geohash: {
        Args:
          | { geog: unknown; maxchars?: number }
          | { geom: unknown; maxchars?: number }
        Returns: string
      }
      st_geomcollfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomcollfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometrytype: {
        Args: { "": unknown }
        Returns: string
      }
      st_geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromgeojson: {
        Args: { "": Json } | { "": Json } | { "": string }
        Returns: unknown
      }
      st_geomfromgml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromkml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfrommarc21: {
        Args: { marc21xml: string }
        Returns: unknown
      }
      st_geomfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromtwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_gmltosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_hasarc: {
        Args: { geometry: unknown }
        Returns: boolean
      }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_isclosed: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_iscollection: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isempty: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygonccw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygoncw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isring: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_issimple: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvalid: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
      }
      st_isvalidreason: {
        Args: { "": unknown }
        Returns: string
      }
      st_isvalidtrajectory: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_length: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_length2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_letters: {
        Args: { font?: Json; letters: string }
        Returns: unknown
      }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefrommultipoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_linefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linemerge: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linestringfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linetocurve: {
        Args: { geometry: unknown }
        Returns: unknown
      }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_m: {
        Args: { "": unknown }
        Returns: number
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makepolygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { "": unknown } | { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_maximuminscribedcircle: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_memsize: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_minimumboundingradius: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_minimumclearance: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumclearanceline: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_mlinefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mlinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multi: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_multilinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multilinestringfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_ndims: {
        Args: { "": unknown }
        Returns: number
      }
      st_node: {
        Args: { g: unknown }
        Returns: unknown
      }
      st_normalize: {
        Args: { geom: unknown }
        Returns: unknown
      }
      st_npoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_nrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numgeometries: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorring: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpatches: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_orientedenvelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { "": unknown } | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_perimeter2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_pointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointonsurface: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_points: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonize: {
        Args: { "": unknown[] }
        Returns: unknown
      }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: string
      }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_reverse: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid: {
        Args: { geog: unknown; srid: number } | { geom: unknown; srid: number }
        Returns: unknown
      }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shiftlongitude: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid: {
        Args: { geog: unknown } | { geom: unknown }
        Returns: number
      }
      st_startpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_summary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_transform: {
        Args:
          | { from_proj: string; geom: unknown; to_proj: string }
          | { from_proj: string; geom: unknown; to_srid: number }
          | { geom: unknown; to_proj: string }
        Returns: unknown
      }
      st_triangulatepolygon: {
        Args: { g1: unknown }
        Returns: unknown
      }
      st_union: {
        Args:
          | { "": unknown[] }
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; gridsize: number }
        Returns: unknown
      }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_wkbtosql: {
        Args: { wkb: string }
        Returns: unknown
      }
      st_wkttosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      st_x: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmin: {
        Args: { "": unknown }
        Returns: number
      }
      st_y: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymax: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymin: {
        Args: { "": unknown }
        Returns: number
      }
      st_z: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmflag: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmin: {
        Args: { "": unknown }
        Returns: number
      }
      text: {
        Args: { "": unknown }
        Returns: string
      }
      unlockrows: {
        Args: { "": string }
        Returns: number
      }
      update_payment_deadline_status: {
        Args: { p_freight_id: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
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
        | "DELIVERED_PENDING_CONFIRMATION"
      payment_method: "PIX" | "BOLETO" | "CARTAO" | "DIRETO"
      urgency_level: "LOW" | "MEDIUM" | "HIGH"
      user_role: "PRODUTOR" | "MOTORISTA" | "ADMIN" | "PRESTADOR_SERVICOS"
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
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown | null
      }
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
        "DELIVERED_PENDING_CONFIRMATION",
      ],
      payment_method: ["PIX", "BOLETO", "CARTAO", "DIRETO"],
      urgency_level: ["LOW", "MEDIUM", "HIGH"],
      user_role: ["PRODUTOR", "MOTORISTA", "ADMIN", "PRESTADOR_SERVICOS"],
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
      ],
    },
  },
} as const
