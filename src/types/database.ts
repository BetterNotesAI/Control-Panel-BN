export interface Database {
  public: {
    Tables: {
      ai_usage_events: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          model: string;
          feature: string | null;
          project_type: string | null;
          project_id: string | null;
          input_tokens: number;
          cached_input_tokens: number;
          output_tokens: number;
          input_cost_usd: number | string;
          cached_input_cost_usd: number | string;
          output_cost_usd: number | string;
          total_cost_usd: number | string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          model: string;
          feature?: string | null;
          project_type?: string | null;
          project_id?: string | null;
          input_tokens?: number;
          cached_input_tokens?: number;
          output_tokens?: number;
          input_cost_usd?: number | string;
          cached_input_cost_usd?: number | string;
          output_cost_usd?: number | string;
          total_cost_usd?: number | string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          model?: string;
          feature?: string | null;
          project_type?: string | null;
          project_id?: string | null;
          input_tokens?: number;
          cached_input_tokens?: number;
          output_tokens?: number;
          input_cost_usd?: number | string;
          cached_input_cost_usd?: number | string;
          output_cost_usd?: number | string;
          total_cost_usd?: number | string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          plan: string;
          display_name: string | null;
          avatar_url: string | null;
          username: string | null;
          short_bio: string | null;
          university: string | null;
          degree: string | null;
          profile_visibility: string;
          language: string;
          created_at: string | null;
          updated_at: string | null;
          admin_role: Database["public"]["Enums"]["admin_role_enum"];
        };
        Insert: {
          id: string;
          email?: string | null;
          plan?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          username?: string | null;
          short_bio?: string | null;
          university?: string | null;
          degree?: string | null;
          profile_visibility?: string;
          language?: string;
          created_at?: string | null;
          updated_at?: string | null;
          admin_role?: Database["public"]["Enums"]["admin_role_enum"];
        };
        Update: {
          id?: string;
          email?: string | null;
          plan?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          username?: string | null;
          short_bio?: string | null;
          university?: string | null;
          degree?: string | null;
          profile_visibility?: string;
          language?: string;
          created_at?: string | null;
          updated_at?: string | null;
          admin_role?: Database["public"]["Enums"]["admin_role_enum"];
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          status: string;
          plan: string | null;
          billing_interval: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          status: string;
          plan?: string | null;
          billing_interval?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: string;
          plan?: string | null;
          billing_interval?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      problem_solver_sessions: {
        Row: {
          id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      user_feedback: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          page_path: string | null;
          source: string;
          status: string;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message: string;
          page_path?: string | null;
          source?: string;
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message?: string;
          page_path?: string | null;
          source?: string;
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      analytics_projects_v: {
        Row: {
          project_type: string;
          project_id: string;
          user_id: string;
          title: string | null;
          status: string | null;
          subtype: string | null;
          source_table: string;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      analytics_ai_usage_events_v: {
        Row: {
          usage_event_id: string;
          created_at: string;
          user_id: string;
          user_email: string | null;
          user_display_name: string | null;
          project_type: string | null;
          project_id: string | null;
          project_title: string | null;
          project_status: string | null;
          project_subtype: string | null;
          project_source: string | null;
          provider: string;
          model: string;
          feature: string | null;
          input_tokens: number;
          cached_input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          input_cost_usd: number | string;
          cached_input_cost_usd: number | string;
          output_cost_usd: number | string;
          total_cost_usd: number | string;
          total_credits: number | string;
          metadata: Record<string, unknown>;
        };
        Relationships: [];
      };
      analytics_ai_usage_by_project_v: {
        Row: {
          user_id: string;
          user_email: string | null;
          user_display_name: string | null;
          project_type: string | null;
          project_id: string | null;
          project_title: string | null;
          project_status: string | null;
          project_subtype: string | null;
          project_source: string | null;
          event_count: number;
          feature_count: number;
          model_count: number;
          first_event_at: string | null;
          last_event_at: string | null;
          input_tokens: number | string;
          cached_input_tokens: number | string;
          output_tokens: number | string;
          total_tokens: number | string;
          total_cost_usd: number | string;
          total_credits: number | string;
        };
        Relationships: [];
      };
      analytics_ai_usage_by_user_feature_model_v: {
        Row: {
          user_id: string;
          user_email: string | null;
          user_display_name: string | null;
          project_type: string | null;
          feature: string | null;
          provider: string;
          model: string;
          event_count: number;
          first_event_at: string | null;
          last_event_at: string | null;
          input_tokens: number | string;
          cached_input_tokens: number | string;
          output_tokens: number | string;
          total_tokens: number | string;
          total_cost_usd: number | string;
          total_credits: number | string;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_database_size_bytes: {
        Args: Record<string, never>;
        Returns: number | string;
      };
    };
    Enums: {
      admin_role_enum: "user" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          id: string;
          name: string;
          owner: string | null;
          created_at: string | null;
          updated_at: string | null;
          public: boolean;
          avif_autodetection: boolean;
          file_size_limit: number | null;
          allowed_mime_types: string[] | null;
        };
        Insert: {
          id: string;
          name: string;
          owner?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          public?: boolean;
          avif_autodetection?: boolean;
          file_size_limit?: number | null;
          allowed_mime_types?: string[] | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          public?: boolean;
          avif_autodetection?: boolean;
          file_size_limit?: number | null;
          allowed_mime_types?: string[] | null;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          id: string;
          bucket_id: string | null;
          name: string;
          owner: string | null;
          created_at: string | null;
          updated_at: string | null;
          last_accessed_at: string | null;
          metadata: Record<string, unknown> | null;
          user_metadata: Record<string, unknown> | null;
          path_tokens: string[] | null;
          version: string | null;
        };
        Insert: {
          id?: string;
          bucket_id?: string | null;
          name: string;
          owner?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          last_accessed_at?: string | null;
          metadata?: Record<string, unknown> | null;
          user_metadata?: Record<string, unknown> | null;
          path_tokens?: string[] | null;
          version?: string | null;
        };
        Update: {
          id?: string;
          bucket_id?: string | null;
          name?: string;
          owner?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          last_accessed_at?: string | null;
          metadata?: Record<string, unknown> | null;
          user_metadata?: Record<string, unknown> | null;
          path_tokens?: string[] | null;
          version?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
