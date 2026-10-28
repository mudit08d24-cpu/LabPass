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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          booking_id: string | null
          created_at: string
          entity: string
          entity_id: string
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          booking_id?: string | null
          created_at?: string
          entity: string
          entity_id: string
          id?: never
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          booking_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: never
          reason?: string | null
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          end_time: string
          id: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          resource_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["badge_kind"]
          name: string
          resource_id: string
          tier: number
        }
        Insert: {
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["badge_kind"]
          name: string
          resource_id: string
          tier: number
        }
        Update: {
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["badge_kind"]
          name?: string
          resource_id?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "badges_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          checks: Json
          created_at: string
          credits_charged: number
          deadline_verified: boolean
          deadline_verified_by: string | null
          decided_by: string | null
          id: string
          photos_purged_at: string | null
          priority_score: number
          purpose: string
          reason: string | null
          reminder_sent_at: string | null
          resource_id: string
          score_breakdown: Json
          status: Database["public"]["Enums"]["booking_status"]
          supervisor_id: string | null
          supervisor_kind: Database["public"]["Enums"]["supervisor_kind"] | null
          time_range: unknown
          updated_at: string
          user_id: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          credits_charged?: number
          deadline_verified?: boolean
          deadline_verified_by?: string | null
          decided_by?: string | null
          id?: string
          photos_purged_at?: string | null
          priority_score?: number
          purpose: string
          reason?: string | null
          reminder_sent_at?: string | null
          resource_id: string
          score_breakdown?: Json
          status?: Database["public"]["Enums"]["booking_status"]
          supervisor_id?: string | null
          supervisor_kind?:
            | Database["public"]["Enums"]["supervisor_kind"]
            | null
          time_range: unknown
          updated_at?: string
          user_id: string
        }
        Update: {
          checks?: Json
          created_at?: string
          credits_charged?: number
          deadline_verified?: boolean
          deadline_verified_by?: string | null
          decided_by?: string | null
          id?: string
          photos_purged_at?: string | null
          priority_score?: number
          purpose?: string
          reason?: string | null
          reminder_sent_at?: string | null
          resource_id?: string
          score_breakdown?: Json
          status?: Database["public"]["Enums"]["booking_status"]
          supervisor_id?: string | null
          supervisor_kind?:
            | Database["public"]["Enums"]["supervisor_kind"]
            | null
          time_range?: unknown
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_deadline_verified_by_fkey"
            columns: ["deadline_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_reports: {
        Row: {
          booking_id: string
          checklist: Json
          created_at: string
          id: string
          notes: string | null
          photo_urls: string[]
          signed_by: string[]
          stage: Database["public"]["Enums"]["report_stage"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          checklist?: Json
          created_at?: string
          id?: string
          notes?: string | null
          photo_urls?: string[]
          signed_by?: string[]
          stage: Database["public"]["Enums"]["report_stage"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          checklist?: Json
          created_at?: string
          id?: string
          notes?: string | null
          photo_urls?: string[]
          signed_by?: string[]
          stage?: Database["public"]["Enums"]["report_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condition_reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      credits_ledger: {
        Row: {
          booking_id: string | null
          change: number
          created_at: string
          created_by: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          change: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          change?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          ai_photo_diff: Json | null
          ai_summary: string | null
          block_until: string | null
          booking_id: string
          created_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["incident_decision"] | null
          description: string
          dispute_outcome: Database["public"]["Enums"]["dispute_outcome"] | null
          id: string
          opened_by: string | null
          penalty_credits: number | null
          photo_urls: string[]
          reason: string | null
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["incident_status"]
          type: Database["public"]["Enums"]["incident_type"]
          updated_at: string
          user_response: string | null
        }
        Insert: {
          ai_photo_diff?: Json | null
          ai_summary?: string | null
          block_until?: string | null
          booking_id: string
          created_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["incident_decision"] | null
          description: string
          dispute_outcome?:
            | Database["public"]["Enums"]["dispute_outcome"]
            | null
          id?: string
          opened_by?: string | null
          penalty_credits?: number | null
          photo_urls?: string[]
          reason?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          type: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          user_response?: string | null
        }
        Update: {
          ai_photo_diff?: Json | null
          ai_summary?: string | null
          block_until?: string | null
          booking_id?: string
          created_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["incident_decision"] | null
          description?: string
          dispute_outcome?:
            | Database["public"]["Enums"]["dispute_outcome"]
            | null
          id?: string
          opened_by?: string | null
          penalty_credits?: number | null
          photo_urls?: string[]
          reason?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          type?: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          user_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          emailed_at: string | null
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emailed_at?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          emailed_at?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          block_reason: string | null
          blocked_until: string | null
          created_at: string
          credits_balance: number
          department_id: string | null
          email: string | null
          id: string
          name: string
          roles: string[]
          roll_no: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          block_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          credits_balance?: number
          department_id?: string | null
          email?: string | null
          id: string
          name?: string
          roles?: string[]
          roll_no?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          block_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          credits_balance?: number
          department_id?: string | null
          email?: string | null
          id?: string
          name?: string
          roles?: string[]
          roll_no?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          pass_mark: number
          questions: Json
          resource_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pass_mark?: number
          questions: Json
          resource_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pass_mark?: number
          questions?: Json
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_checkin_codes: {
        Row: {
          code: string
          resource_id: string
          rotated_at: string
        }
        Insert: {
          code?: string
          resource_id: string
          rotated_at?: string
        }
        Update: {
          code?: string
          resource_id?: string
          rotated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_checkin_codes_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          checklist: Json
          created_at: string
          department_id: string
          deposit_amount: number
          id: string
          location: string | null
          manager_id: string
          max_hours: number
          name: string
          photos: string[]
          status: Database["public"]["Enums"]["resource_status"]
          tier: number
          type: Database["public"]["Enums"]["resource_type"]
          updated_at: string
          weekly_cap_hours: number
        }
        Insert: {
          checklist?: Json
          created_at?: string
          department_id: string
          deposit_amount?: number
          id?: string
          location?: string | null
          manager_id: string
          max_hours: number
          name: string
          photos?: string[]
          status?: Database["public"]["Enums"]["resource_status"]
          tier: number
          type: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
          weekly_cap_hours?: number
        }
        Update: {
          checklist?: Json
          created_at?: string
          department_id?: string
          deposit_amount?: number
          id?: string
          location?: string | null
          manager_id?: string
          max_hours?: number
          name?: string
          photos?: string[]
          status?: Database["public"]["Enums"]["resource_status"]
          tier?: number
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
          weekly_cap_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_approvals: {
        Row: {
          approved_by: string | null
          created_at: string
          decided_at: string | null
          id: string
          reason: string | null
          resource_id: string
          status: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          reason?: string | null
          resource_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          reason?: string | null
          resource_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_approvals_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_approvals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_slots: {
        Row: {
          id: string
          resource_id: string
          supervisor_id: string
          time_range: unknown
        }
        Insert: {
          id?: string
          resource_id: string
          supervisor_id: string
          time_range: unknown
        }
        Update: {
          id?: string
          resource_id?: string
          supervisor_id?: string
          time_range?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_slots_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_slots_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          ai_extraction: Json | null
          badge_id: string
          decided_at: string | null
          evidence_url: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string
          user_id: string
        }
        Insert: {
          ai_extraction?: Json | null
          badge_id: string
          decided_at?: string | null
          evidence_url?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          user_id: string
        }
        Update: {
          ai_extraction?: Json | null
          badge_id?: string
          decided_at?: string | null
          evidence_url?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flags: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence: Json
          id: string
          proposed_block_days: number | null
          reason: string | null
          source: Database["public"]["Enums"]["flag_source"]
          status: Database["public"]["Enums"]["flag_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: Json
          id?: string
          proposed_block_days?: number | null
          reason?: string | null
          source: Database["public"]["Enums"]["flag_source"]
          status?: Database["public"]["Enums"]["flag_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: Json
          id?: string
          proposed_block_days?: number | null
          reason?: string | null
          source?: Database["public"]["Enums"]["flag_source"]
          status?: Database["public"]["Enums"]["flag_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_flags_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_offers: {
        Row: {
          booking_id: string
          created_by: string | null
          expires_at: string
          id: string
          offered_at: string
          status: Database["public"]["Enums"]["offer_status"]
        }
        Insert: {
          booking_id: string
          created_by?: string | null
          expires_at: string
          id?: string
          offered_at?: string
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Update: {
          booking_id?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          offered_at?: string
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_offers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_created_by_fkey"
            columns: ["created_by"]
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
      accept_waitlist_offer: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      adjust_credits: {
        Args: {
          p_booking_id?: string
          p_change: number
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      apply_as_supervisor: { Args: { p_resource: string }; Returns: string }
      can_configure_resource: {
        Args: { target_resource: string }
        Returns: boolean
      }
      can_manage_department: {
        Args: { target_department: string }
        Returns: boolean
      }
      can_manage_resource: {
        Args: { target_resource: string }
        Returns: boolean
      }
      can_review_certificate_file: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_upload_booking_evidence: {
        Args: { target_booking: string }
        Returns: boolean
      }
      can_view_profile: { Args: { target: string }; Returns: boolean }
      cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      check_in_booking: {
        Args: { p_booking_id: string; p_code: string }
        Returns: undefined
      }
      close_incident: {
        Args: { p_incident_id: string; p_reason?: string }
        Returns: undefined
      }
      condition_photos_due_for_purge: {
        Args: never
        Returns: {
          booking_id: string
          photo_paths: string[]
        }[]
      }
      confirm_return: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      decide_certificate: {
        Args: { p_decision: string; p_reason?: string; p_user_badge_id: string }
        Returns: undefined
      }
      decide_incident: {
        Args: {
          p_block_days?: number
          p_decision: Database["public"]["Enums"]["incident_decision"]
          p_incident_id: string
          p_penalty_credits?: number
          p_reason: string
        }
        Returns: Json
      }
      decide_supervisor: {
        Args: { p_approval_id: string; p_decision: string; p_reason?: string }
        Returns: undefined
      }
      decide_user_flag: {
        Args: {
          p_block_days?: number
          p_confirm: boolean
          p_flag_id: string
          p_reason: string
        }
        Returns: undefined
      }
      decline_waitlist_offer: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      evaluate_booking: {
        Args: {
          p_end: string
          p_resource_id: string
          p_start: string
          p_supervisor_id?: string
        }
        Returns: Json
      }
      expire_stale_requests: { Args: never; Returns: number }
      expire_waitlist_offers: { Args: never; Returns: number }
      get_checkin_code: { Args: { p_resource: string }; Returns: string }
      get_quiz: { Args: { p_resource: string }; Returns: Json }
      graduate_student: {
        Args: { p_reason: string; p_resource: string; p_user: string }
        Returns: undefined
      }
      graduation_progress: {
        Args: { p_resource: string; p_user?: string }
        Returns: Json
      }
      grant_weekly_credits: { Args: never; Returns: number }
      has_role: { Args: { required_role: string }; Returns: boolean }
      idle_radar: {
        Args: { p_from: string; p_to: string }
        Returns: {
          available_hours: number
          booked_hours: number
          bottleneck: boolean
          department_id: string
          hours_unlocked: number
          no_show_rate: number
          resource_id: string
          resource_name: string
          used_hours: number
          utilisation: number
          waitlist_length: number
        }[]
      }
      idle_radar_hourly: {
        Args: { p_from: string; p_resource: string; p_to: string }
        Returns: {
          booked_hours: number
          hour: number
          weekday: number
        }[]
      }
      is_booking_participant: {
        Args: { target_booking: string }
        Returns: boolean
      }
      is_supervisor_for: { Args: { target_resource: string }; Returns: boolean }
      labpass_config: { Args: never; Returns: Json }
      lift_user_block: {
        Args: { p_reason: string; p_user: string }
        Returns: undefined
      }
      list_assignable_managers: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      list_supervisor_availability: {
        Args: { p_from: string; p_resource: string; p_to: string }
        Returns: {
          kind: Database["public"]["Enums"]["supervisor_kind"]
          slot_id: string
          supervisor_id: string
          supervisor_name: string
          time_range: unknown
        }[]
      }
      log_ai_suggestion: {
        Args: {
          p_actor?: string
          p_booking_id?: string
          p_entity: string
          p_entity_id: string
          p_feature: string
          p_output: Json
        }
        Returns: undefined
      }
      manager_decide_booking: {
        Args: { p_booking_id: string; p_decision: string; p_reason?: string }
        Returns: undefined
      }
      mark_booking_no_shows: { Args: never; Returns: number }
      mark_bookings_overdue: { Args: never; Returns: number }
      mark_condition_photos_purged: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      my_eligibility: { Args: { p_resource: string }; Returns: Json }
      my_waitlist_rank: { Args: { p_booking_id: string }; Returns: Json }
      open_incident: {
        Args: {
          p_booking_id: string
          p_description: string
          p_photo_paths?: string[]
          p_type: Database["public"]["Enums"]["incident_type"]
        }
        Returns: string
      }
      queue_booking_reminders: { Args: never; Returns: number }
      record_ai_pattern_flag: {
        Args: {
          p_evidence: Json
          p_proposed_block_days?: number
          p_user: string
        }
        Returns: string
      }
      request_booking: {
        Args: {
          p_end: string
          p_purpose: string
          p_resource_id: string
          p_start: string
          p_supervisor_id?: string
        }
        Returns: string
      }
      resolve_incident_dispute: {
        Args: {
          p_incident_id: string
          p_outcome: Database["public"]["Enums"]["dispute_outcome"]
          p_reason: string
        }
        Returns: undefined
      }
      resource_busy_times: {
        Args: { p_from: string; p_resource: string; p_to: string }
        Returns: {
          time_range: unknown
        }[]
      }
      respond_to_incident: {
        Args: { p_dispute?: boolean; p_incident_id: string; p_response: string }
        Returns: undefined
      }
      return_booking: { Args: { p_booking_id: string }; Returns: undefined }
      rotate_checkin_code: { Args: { p_resource: string }; Returns: string }
      run_scheduled_jobs: { Args: never; Returns: Json }
      save_certificate_ai: {
        Args: { p_extraction: Json; p_user_badge_id: string }
        Returns: undefined
      }
      save_condition_report: {
        Args: {
          p_booking_id: string
          p_checklist?: Json
          p_notes?: string
          p_photo_paths?: string[]
          p_stage: Database["public"]["Enums"]["report_stage"]
        }
        Returns: string
      }
      save_incident_ai: {
        Args: { p_incident_id: string; p_photo_diff: Json; p_summary: string }
        Returns: undefined
      }
      set_deadline_verified: {
        Args: { p_booking_id: string; p_reason: string; p_verified: boolean }
        Returns: Json
      }
      set_resource_status: {
        Args: {
          p_reason: string
          p_resource: string
          p_status: Database["public"]["Enums"]["resource_status"]
        }
        Returns: undefined
      }
      sign_condition_report: {
        Args: { p_report_id: string }
        Returns: undefined
      }
      start_incident_review: {
        Args: { p_incident_id: string }
        Returns: undefined
      }
      submit_certificate: {
        Args: { p_badge_id: string; p_file_path: string }
        Returns: string
      }
      submit_quiz: {
        Args: { p_answers: Json; p_resource: string }
        Returns: Json
      }
      uuid_or_null: { Args: { t: string }; Returns: string }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected" | "suspended"
      badge_kind: "quiz" | "certificate" | "graduation"
      booking_status:
        | "requested"
        | "approved"
        | "rejected"
        | "waitlisted"
        | "cancelled"
        | "checked_in"
        | "no_show"
        | "overdue"
        | "returned"
        | "completed"
      dispute_outcome: "upheld" | "overturned"
      flag_source: "no_show_rule" | "ai_pattern"
      flag_status: "pending" | "confirmed" | "dismissed"
      incident_decision:
        | "no_action"
        | "warning"
        | "credit_penalty"
        | "temporary_block"
      incident_status:
        | "open"
        | "under_review"
        | "decided"
        | "disputed"
        | "closed"
      incident_type: "damage" | "delay" | "missing_item" | "other"
      offer_status: "offered" | "accepted" | "expired" | "declined"
      profile_status: "active" | "suspended"
      report_stage: "check_in" | "return"
      resource_status: "active" | "inactive" | "maintenance"
      resource_type: "space" | "equipment" | "specialised"
      supervisor_kind: "staff" | "peer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      approval_status: ["pending", "approved", "rejected", "suspended"],
      badge_kind: ["quiz", "certificate", "graduation"],
      booking_status: [
        "requested",
        "approved",
        "rejected",
        "waitlisted",
        "cancelled",
        "checked_in",
        "no_show",
        "overdue",
        "returned",
        "completed",
      ],
      dispute_outcome: ["upheld", "overturned"],
      flag_source: ["no_show_rule", "ai_pattern"],
      flag_status: ["pending", "confirmed", "dismissed"],
      incident_decision: [
        "no_action",
        "warning",
        "credit_penalty",
        "temporary_block",
      ],
      incident_status: [
        "open",
        "under_review",
        "decided",
        "disputed",
        "closed",
      ],
      incident_type: ["damage", "delay", "missing_item", "other"],
      offer_status: ["offered", "accepted", "expired", "declined"],
      profile_status: ["active", "suspended"],
      report_stage: ["check_in", "return"],
      resource_status: ["active", "inactive", "maintenance"],
      resource_type: ["space", "equipment", "specialised"],
      supervisor_kind: ["staff", "peer"],
    },
  },
} as const
