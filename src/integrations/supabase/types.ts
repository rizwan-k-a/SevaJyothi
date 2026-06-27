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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      complaint_events: {
        Row: {
          actor_id: string | null
          complaint_id: string
          created_at: string
          event: string
          id: string
          meta: Json | null
        }
        Insert: {
          actor_id?: string | null
          complaint_id: string
          created_at?: string
          event: string
          id?: string
          meta?: Json | null
        }
        Update: {
          actor_id?: string | null
          complaint_id?: string
          created_at?: string
          event?: string
          id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          accuracy: number | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          client_id: string | null
          created_at: string
          description: string
          id: string
          lat: number | null
          lng: number | null
          photo_path: string | null
          priority: Database["public"]["Enums"]["complaint_priority"]
          priority_score: number
          reporter_id: string
          resolution_note: string | null
          resolution_photo_path: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
          village: string | null
        }
        Insert: {
          accuracy?: number | null
          assigned_to?: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          client_id?: string | null
          created_at?: string
          description: string
          id?: string
          lat?: number | null
          lng?: number | null
          photo_path?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          priority_score?: number
          reporter_id: string
          resolution_note?: string | null
          resolution_photo_path?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          village?: string | null
        }
        Update: {
          accuracy?: number | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          client_id?: string | null
          created_at?: string
          description?: string
          id?: string
          lat?: number | null
          lng?: number | null
          photo_path?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          priority_score?: number
          reporter_id?: string
          resolution_note?: string | null
          resolution_photo_path?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          complaint_id: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          complaint_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          complaint_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
          village: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          village?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_audit_logs: {
        Row: {
          actor_id: string | null
          complaint_id: string | null
          created_at: string
          event_type: string
          id: number
          ip: unknown
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          complaint_id?: string | null
          created_at?: string
          event_type: string
          id?: number
          ip?: unknown
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          complaint_id?: string | null
          created_at?: string
          event_type?: string
          id?: number
          ip?: unknown
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_complaint_hotspots: {
        Args: { _min_incidents?: number }
        Returns: {
          dominant_category: string
          incidents: number
          lat: number
          lng: number
          total_priority: number
        }[]
      }
      admin_complaint_stats: { Args: never; Returns: Json }
      admin_complaint_stats_v2: { Args: never; Returns: Json }
      admin_complaint_stats_v3: { Args: never; Returns: Json }
      admin_nearest_technician: {
        Args: { _complaint_id: string }
        Returns: {
          display_name: string
          distance_km: number
          open_jobs: number
          technician_id: string
        }[]
      }
      admin_predictive_risk: {
        Args: never
        Returns: {
          avg_priority: number
          category: string
          incidents_90d: number
          monsoon_weight: number
          recurrence_rate: number
          risk_score: number
          village: string
        }[]
      }
      app_log_event: {
        Args: { _complaint_id?: string; _event_type: string; _metadata?: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "citizen" | "authority" | "technician"
      complaint_category:
        | "transformer"
        | "water_pipe"
        | "road_damage"
        | "street_light"
        | "sewage_leak"
        | "network_tower"
      complaint_priority: "low" | "normal" | "high" | "critical"
      complaint_status:
        | "submitted"
        | "triaged"
        | "assigned"
        | "en_route"
        | "on_site"
        | "resolved"
        | "closed"
      notification_type:
        | "complaint_submitted"
        | "complaint_synced"
        | "complaint_assigned"
        | "repair_started"
        | "repair_completed"
        | "new_complaint_alert"
        | "assignment_alert"
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
      app_role: ["citizen", "authority", "technician"],
      complaint_category: [
        "transformer",
        "water_pipe",
        "road_damage",
        "street_light",
        "sewage_leak",
        "network_tower",
      ],
      complaint_priority: ["low", "normal", "high", "critical"],
      complaint_status: [
        "submitted",
        "triaged",
        "assigned",
        "en_route",
        "on_site",
        "resolved",
        "closed",
      ],
      notification_type: [
        "complaint_submitted",
        "complaint_synced",
        "complaint_assigned",
        "repair_started",
        "repair_completed",
        "new_complaint_alert",
        "assignment_alert",
      ],
    },
  },
} as const
