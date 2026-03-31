export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          created_at: string | null;
          admin_role: Database["public"]["Enums"]["admin_role_enum"];
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string | null;
          admin_role?: Database["public"]["Enums"]["admin_role_enum"];
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string | null;
          admin_role?: Database["public"]["Enums"]["admin_role_enum"];
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
