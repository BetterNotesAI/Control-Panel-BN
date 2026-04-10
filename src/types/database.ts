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
          input_tokens: number;
          cached_input_tokens: number;
          output_tokens: number;
          total_cost_usd: number | string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          model: string;
          feature?: string | null;
          input_tokens?: number;
          cached_input_tokens?: number;
          output_tokens?: number;
          total_cost_usd?: number | string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          model?: string;
          feature?: string | null;
          input_tokens?: number;
          cached_input_tokens?: number;
          output_tokens?: number;
          total_cost_usd?: number | string;
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
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      admin_role_enum: "user" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
}
