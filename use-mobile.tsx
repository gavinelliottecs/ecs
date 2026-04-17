export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          address: string;
          description: string;
          status: string;
          start_date: string;
          color: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          address?: string;
          description?: string;
          status?: string;
          start_date: string;
          color?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          address?: string;
          description?: string;
          status?: string;
          start_date?: string;
          color?: string;
        };
      };
      phases: {
        Row: {
          id: number;
          project_id: number;
          name: string;
          sort_order: number;
          color: string;
        };
        Insert: {
          id?: number;
          project_id: number;
          name: string;
          sort_order?: number;
          color?: string;
        };
        Update: {
          id?: number;
          project_id?: number;
          name?: string;
          sort_order?: number;
          color?: string;
        };
      };
      tasks: {
        Row: {
          id: number;
          project_id: number;
          phase_id: number | null;
          name: string;
          start_date: string;
          duration_weeks: number;
          status: string;
          category: string;
          notes: string;
          sort_order: number;
        };
        Insert: {
          id?: number;
          project_id: number;
          phase_id?: number | null;
          name: string;
          start_date: string;
          duration_weeks?: number;
          status?: string;
          category?: string;
          notes?: string;
          sort_order?: number;
        };
        Update: {
          id?: number;
          project_id?: number;
          phase_id?: number | null;
          name?: string;
          start_date?: string;
          duration_weeks?: number;
          status?: string;
          category?: string;
          notes?: string;
          sort_order?: number;
        };
      };
      budgets: {
        Row: {
          id: number;
          project_id: number;
          original_value: number;
          notes: string | null;
        };
        Insert: {
          id?: number;
          project_id: number;
          original_value?: number;
          notes?: string | null;
        };
        Update: {
          id?: number;
          project_id?: number;
          original_value?: number;
          notes?: string | null;
        };
      };
      cost_items: {
        Row: {
          id: number;
          project_id: number;
          type: string;
          category: string;
          description: string;
          amount: number;
          date: string;
          reference: string | null;
          supplier: string | null;
          notes: string | null;
          attachment_url: string | null;
          created_at: string | null;
          worker_name: string;
          hours_worked: number;
          day_rate: number;
        };
        Insert: {
          id?: number;
          project_id: number;
          type: string;
          category?: string;
          description: string;
          amount?: number;
          date: string;
          reference?: string | null;
          supplier?: string | null;
          notes?: string | null;
          attachment_url?: string | null;
          worker_name?: string;
          hours_worked?: number;
          day_rate?: number;
        };
        Update: {
          id?: number;
          project_id?: number;
          type?: string;
          category?: string;
          description?: string;
          amount?: number;
          date?: string;
          reference?: string | null;
          supplier?: string | null;
          notes?: string | null;
          attachment_url?: string | null;
          worker_name?: string;
          hours_worked?: number;
          day_rate?: number;
        };
      };
      schedule_entries: {
        Row: {
          id: number;
          project_id: number | null;
          date: string;
          task_description: string;
          workers: string;
          notes: string;
          color: string;
          created_at: string | null;
          source_labour_id: number | null;
        };
        Insert: {
          id?: number;
          project_id?: number | null;
          date: string;
          task_description?: string;
          workers?: string;
          notes?: string;
          color?: string;
          source_labour_id?: number | null;
        };
        Update: {
          id?: number;
          project_id?: number | null;
          date?: string;
          task_description?: string;
          workers?: string;
          notes?: string;
          color?: string;
          source_labour_id?: number | null;
        };
      };
      schedule_absences: {
        Row: {
          id: number;
          user_id: string;
          date: string;
          worker_name: string;
          reason: string;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          date: string;
          worker_name?: string;
          reason?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          date?: string;
          worker_name?: string;
          reason?: string;
        };
      };
      worker_profiles: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          default_day_rate: number;
          default_category: string;
          default_supplier: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          default_day_rate?: number;
          default_category?: string;
          default_supplier?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          default_day_rate?: number;
          default_category?: string;
          default_supplier?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
