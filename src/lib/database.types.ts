export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      access_history: {
        Row: {
          business_id: string;
          created_at: string;
          device: string | null;
          event: string;
          id: string;
          member_id: string | null;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          device?: string | null;
          event: string;
          id?: string;
          member_id?: string | null;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          device?: string | null;
          event?: string;
          id?: string;
          member_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'access_history_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'access_history_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      accounts: {
        Row: {
          business_id: string;
          code: string;
          id: string;
          name: string;
          system_key: string | null;
          type: Database['public']['Enums']['account_type'];
        };
        Insert: {
          business_id: string;
          code: string;
          id?: string;
          name: string;
          system_key?: string | null;
          type: Database['public']['Enums']['account_type'];
        };
        Update: {
          business_id?: string;
          code?: string;
          id?: string;
          name?: string;
          system_key?: string | null;
          type?: Database['public']['Enums']['account_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      appointment_services: {
        Row: {
          appointment_id: string;
          duration_min: number;
          employee_id: string | null;
          id: string;
          name_snapshot: string;
          price_minor: number;
          service_id: string;
        };
        Insert: {
          appointment_id: string;
          duration_min: number;
          employee_id?: string | null;
          id?: string;
          name_snapshot: string;
          price_minor: number;
          service_id: string;
        };
        Update: {
          appointment_id?: string;
          duration_min?: number;
          employee_id?: string | null;
          id?: string;
          name_snapshot?: string;
          price_minor?: number;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appointment_services_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointment_services_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointment_services_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      appointments: {
        Row: {
          branch_id: string;
          business_date: string;
          business_id: string;
          cancel_reason: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_name: string | null;
          deposit_method: Database['public']['Enums']['payment_method'] | null;
          deposit_minor: number;
          deposit_status: Database['public']['Enums']['deposit_status'];
          duration_min: number;
          employee_id: string | null;
          id: string;
          notes: string | null;
          room_id: string | null;
          sale_id: string | null;
          scheduled_at: string;
          source: Database['public']['Enums']['appointment_source'];
          started_at: string | null;
          status: Database['public']['Enums']['appointment_status'];
          updated_at: string;
          wait_notified_at: string | null;
        };
        Insert: {
          branch_id: string;
          business_date: string;
          business_id: string;
          cancel_reason?: string | null;
          checked_in_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          deposit_method?: Database['public']['Enums']['payment_method'] | null;
          deposit_minor?: number;
          deposit_status?: Database['public']['Enums']['deposit_status'];
          duration_min?: number;
          employee_id?: string | null;
          id?: string;
          notes?: string | null;
          room_id?: string | null;
          sale_id?: string | null;
          scheduled_at: string;
          source: Database['public']['Enums']['appointment_source'];
          started_at?: string | null;
          status: Database['public']['Enums']['appointment_status'];
          updated_at?: string;
          wait_notified_at?: string | null;
        };
        Update: {
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          cancel_reason?: string | null;
          checked_in_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          deposit_method?: Database['public']['Enums']['payment_method'] | null;
          deposit_minor?: number;
          deposit_status?: Database['public']['Enums']['deposit_status'];
          duration_min?: number;
          employee_id?: string | null;
          id?: string;
          notes?: string | null;
          room_id?: string | null;
          sale_id?: string | null;
          scheduled_at?: string;
          source?: Database['public']['Enums']['appointment_source'];
          started_at?: string | null;
          status?: Database['public']['Enums']['appointment_status'];
          updated_at?: string;
          wait_notified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_sale_fk';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance: {
        Row: {
          branch_id: string;
          business_date: string;
          business_id: string;
          clock_in: string;
          clock_in_by: string | null;
          clock_out: string | null;
          clock_out_by: string | null;
          created_at: string;
          employee_id: string;
          id: string;
          late: boolean;
          late_minutes: number;
        };
        Insert: {
          branch_id: string;
          business_date: string;
          business_id: string;
          clock_in: string;
          clock_in_by?: string | null;
          clock_out?: string | null;
          clock_out_by?: string | null;
          created_at?: string;
          employee_id: string;
          id?: string;
          late?: boolean;
          late_minutes?: number;
        };
        Update: {
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          clock_in?: string;
          clock_in_by?: string | null;
          clock_out?: string | null;
          clock_out_by?: string | null;
          created_at?: string;
          employee_id?: string;
          id?: string;
          late?: boolean;
          late_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_clock_in_by_fkey';
            columns: ['clock_in_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_clock_out_by_fkey';
            columns: ['clock_out_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance_breaks: {
        Row: {
          attendance_id: string;
          branch_id: string;
          business_id: string;
          created_at: string;
          ended_at: string | null;
          ended_by: string | null;
          id: string;
          started_at: string;
          started_by: string | null;
        };
        Insert: {
          attendance_id: string;
          branch_id: string;
          business_id: string;
          created_at?: string;
          ended_at?: string | null;
          ended_by?: string | null;
          id?: string;
          started_at: string;
          started_by?: string | null;
        };
        Update: {
          attendance_id?: string;
          branch_id?: string;
          business_id?: string;
          created_at?: string;
          ended_at?: string | null;
          ended_by?: string | null;
          id?: string;
          started_at?: string;
          started_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_breaks_attendance_id_fkey';
            columns: ['attendance_id'];
            isOneToOne: false;
            referencedRelation: 'attendance';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_breaks_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_breaks_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_breaks_ended_by_fkey';
            columns: ['ended_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_breaks_started_by_fkey';
            columns: ['started_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_member_id: string | null;
          after: Json | null;
          before: Json | null;
          branch_id: string | null;
          business_id: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          summary: string;
        };
        Insert: {
          action: string;
          actor_member_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          branch_id?: string | null;
          business_id: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          summary: string;
        };
        Update: {
          action?: string;
          actor_member_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          branch_id?: string | null;
          business_id?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_member_id_fkey';
            columns: ['actor_member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      branches: {
        Row: {
          address: string | null;
          business_id: string;
          created_at: string;
          id: string;
          invoice_prefix: string | null;
          mode: Database['public']['Enums']['salon_mode'];
          name: string;
          opening_hours: NonNullable<Json>;
          phone: string | null;
          settings: NonNullable<Json>;
          tax_id_label: string;
          tax_inclusive: boolean;
          tax_name: string;
          tax_rate_bps: number;
          trn: string | null;
          vat_mode: Database['public']['Enums']['vat_mode'];
        };
        Insert: {
          address?: string | null;
          business_id: string;
          created_at?: string;
          id?: string;
          invoice_prefix?: string | null;
          mode: Database['public']['Enums']['salon_mode'];
          name: string;
          opening_hours?: NonNullable<Json>;
          phone?: string | null;
          settings?: NonNullable<Json>;
          tax_id_label?: string;
          tax_inclusive?: boolean;
          tax_name?: string;
          tax_rate_bps?: number;
          trn?: string | null;
          vat_mode?: Database['public']['Enums']['vat_mode'];
        };
        Update: {
          address?: string | null;
          business_id?: string;
          created_at?: string;
          id?: string;
          invoice_prefix?: string | null;
          mode?: Database['public']['Enums']['salon_mode'];
          name?: string;
          opening_hours?: NonNullable<Json>;
          phone?: string | null;
          settings?: NonNullable<Json>;
          tax_id_label?: string;
          tax_inclusive?: boolean;
          tax_name?: string;
          tax_rate_bps?: number;
          trn?: string | null;
          vat_mode?: Database['public']['Enums']['vat_mode'];
        };
        Relationships: [
          {
            foreignKeyName: 'branches_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      businesses: {
        Row: {
          close_note: string | null;
          closed_at: string | null;
          closed_by: string | null;
          code: string;
          country_code: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          is_demo: boolean;
          name: string;
          timezone: string;
        };
        Insert: {
          close_note?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          code: string;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          is_demo?: boolean;
          name: string;
          timezone?: string;
        };
        Update: {
          close_note?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          code?: string;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          is_demo?: boolean;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      cash_closings: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          branch_id: string;
          business_date: string;
          business_id: string;
          counted_by: string | null;
          counted_cash_minor: number | null;
          created_at: string;
          created_by: string | null;
          denominations: NonNullable<Json>;
          drawer_closed_confirmed: boolean;
          expected_cash_minor: number | null;
          id: string;
          opening_cash_minor: number | null;
          reason: string | null;
          returned_reason: string | null;
          status: string;
          submitted_at: string | null;
          submitted_by: string | null;
          taken_out_minor: number;
          taken_out_to: string | null;
          updated_at: string;
          variance_minor: number | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id: string;
          business_date: string;
          business_id: string;
          counted_by?: string | null;
          counted_cash_minor?: number | null;
          created_at?: string;
          created_by?: string | null;
          denominations?: NonNullable<Json>;
          drawer_closed_confirmed?: boolean;
          expected_cash_minor?: number | null;
          id?: string;
          opening_cash_minor?: number | null;
          reason?: string | null;
          returned_reason?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          taken_out_minor?: number;
          taken_out_to?: string | null;
          updated_at?: string;
          variance_minor?: number | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          counted_by?: string | null;
          counted_cash_minor?: number | null;
          created_at?: string;
          created_by?: string | null;
          denominations?: NonNullable<Json>;
          drawer_closed_confirmed?: boolean;
          expected_cash_minor?: number | null;
          id?: string;
          opening_cash_minor?: number | null;
          reason?: string | null;
          returned_reason?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          taken_out_minor?: number;
          taken_out_to?: string | null;
          updated_at?: string;
          variance_minor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_closings_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_closings_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_closings_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_closings_counted_by_fkey';
            columns: ['counted_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_closings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_closings_submitted_by_fkey';
            columns: ['submitted_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      compliance_documents: {
        Row: {
          active: boolean;
          branch_id: string | null;
          business_id: string;
          created_at: string;
          created_by: string | null;
          doc_type: string;
          employee_id: string | null;
          evidence_path: string | null;
          expires_on: string | null;
          holder_type: string;
          id: string;
          issued_on: string | null;
          number: string | null;
          previous_id: string | null;
          reminder_days: number;
          remove_reason: string | null;
          removed_at: string | null;
          removed_by: string | null;
          renewal_cost_minor: number | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          branch_id?: string | null;
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          doc_type: string;
          employee_id?: string | null;
          evidence_path?: string | null;
          expires_on?: string | null;
          holder_type: string;
          id?: string;
          issued_on?: string | null;
          number?: string | null;
          previous_id?: string | null;
          reminder_days?: number;
          remove_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          renewal_cost_minor?: number | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          branch_id?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          doc_type?: string;
          employee_id?: string | null;
          evidence_path?: string | null;
          expires_on?: string | null;
          holder_type?: string;
          id?: string;
          issued_on?: string | null;
          number?: string | null;
          previous_id?: string | null;
          reminder_days?: number;
          remove_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          renewal_cost_minor?: number | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'compliance_documents_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_documents_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_documents_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_documents_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_documents_previous_id_fkey';
            columns: ['previous_id'];
            isOneToOne: false;
            referencedRelation: 'compliance_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_documents_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      compliance_removals: {
        Row: {
          branch_id: string | null;
          business_id: string;
          created_at: string;
          doc_type: string;
          document_id: string | null;
          employee_id: string | null;
          holder_type: string;
          id: string;
          reason: string | null;
          removed_by: string | null;
        };
        Insert: {
          branch_id?: string | null;
          business_id: string;
          created_at?: string;
          doc_type: string;
          document_id?: string | null;
          employee_id?: string | null;
          holder_type: string;
          id?: string;
          reason?: string | null;
          removed_by?: string | null;
        };
        Update: {
          branch_id?: string | null;
          business_id?: string;
          created_at?: string;
          doc_type?: string;
          document_id?: string | null;
          employee_id?: string | null;
          holder_type?: string;
          id?: string;
          reason?: string | null;
          removed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'compliance_removals_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_removals_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_removals_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'compliance_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_removals_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_removals_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          last_visit_at: string | null;
          marketing_opt_in: boolean;
          name: string;
          no_show_count: number;
          notes: string | null;
          phone: string | null;
          preferences: string | null;
          preferred_employee_id: string | null;
          risk_flags: string[];
          visit_count: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_visit_at?: string | null;
          marketing_opt_in?: boolean;
          name: string;
          no_show_count?: number;
          notes?: string | null;
          phone?: string | null;
          preferences?: string | null;
          preferred_employee_id?: string | null;
          risk_flags?: string[];
          visit_count?: number;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_visit_at?: string | null;
          marketing_opt_in?: boolean;
          name?: string;
          no_show_count?: number;
          notes?: string | null;
          phone?: string | null;
          preferences?: string | null;
          preferred_employee_id?: string | null;
          risk_flags?: string[];
          visit_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customers_preferred_employee_id_fkey';
            columns: ['preferred_employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      employees: {
        Row: {
          active: boolean;
          base_salary_minor: number;
          branch_id: string;
          business_id: string;
          colour: string | null;
          commission_bps: number;
          created_at: string;
          employee_code: string | null;
          full_name: string;
          id: string;
          member_id: string | null;
          phone: string | null;
          role_title: string;
          wps_required: boolean;
        };
        Insert: {
          active?: boolean;
          base_salary_minor?: number;
          branch_id: string;
          business_id: string;
          colour?: string | null;
          commission_bps?: number;
          created_at?: string;
          employee_code?: string | null;
          full_name: string;
          id?: string;
          member_id?: string | null;
          phone?: string | null;
          role_title?: string;
          wps_required?: boolean;
        };
        Update: {
          active?: boolean;
          base_salary_minor?: number;
          branch_id?: string;
          business_id?: string;
          colour?: string | null;
          commission_bps?: number;
          created_at?: string;
          employee_code?: string | null;
          full_name?: string;
          id?: string;
          member_id?: string | null;
          phone?: string | null;
          role_title?: string;
          wps_required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'employees_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employees_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employees_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: true;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_categories: {
        Row: {
          account_id: string | null;
          archived: boolean;
          business_id: string;
          icon: string;
          id: string;
          key: string | null;
          name: string;
          sort: number;
        };
        Insert: {
          account_id?: string | null;
          archived?: boolean;
          business_id: string;
          icon?: string;
          id?: string;
          key?: string | null;
          name: string;
          sort?: number;
        };
        Update: {
          account_id?: string | null;
          archived?: boolean;
          business_id?: string;
          icon?: string;
          id?: string;
          key?: string | null;
          name?: string;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_categories_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_categories_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          category_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          method: Database['public']['Enums']['payment_method'];
          note: string | null;
          paid_by_member_id: string | null;
          receipt_path: string | null;
          reverse_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          status: string;
          vat_minor: number;
        };
        Insert: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          category_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          method: Database['public']['Enums']['payment_method'];
          note?: string | null;
          paid_by_member_id?: string | null;
          receipt_path?: string | null;
          reverse_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: string;
          vat_minor?: number;
        };
        Update: {
          amount_minor?: number;
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          category_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          method?: Database['public']['Enums']['payment_method'];
          note?: string | null;
          paid_by_member_id?: string | null;
          receipt_path?: string | null;
          reverse_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: string;
          vat_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_paid_by_member_id_fkey';
            columns: ['paid_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_reversed_by_fkey';
            columns: ['reversed_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      hygiene_logs: {
        Row: {
          branch_id: string;
          business_date: string;
          business_id: string;
          checklist: NonNullable<Json>;
          created_at: string;
          evidence_path: string | null;
          id: string;
          note: string | null;
          signed_by: string | null;
        };
        Insert: {
          branch_id: string;
          business_date: string;
          business_id: string;
          checklist: NonNullable<Json>;
          created_at?: string;
          evidence_path?: string | null;
          id?: string;
          note?: string | null;
          signed_by?: string | null;
        };
        Update: {
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          checklist?: NonNullable<Json>;
          created_at?: string;
          evidence_path?: string | null;
          id?: string;
          note?: string | null;
          signed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hygiene_logs_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hygiene_logs_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hygiene_logs_signed_by_fkey';
            columns: ['signed_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_items: {
        Row: {
          active: boolean;
          assigned_to: string | null;
          avg_unit_cost_minor: number;
          business_id: string;
          condition: string | null;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['item_kind'];
          location: string | null;
          montaji_reg_no: string | null;
          name: string;
          next_service_date: string | null;
          pack_size: number;
          reorder_level: number;
          sell_price_minor: number | null;
          unit: string;
        };
        Insert: {
          active?: boolean;
          assigned_to?: string | null;
          avg_unit_cost_minor?: number;
          business_id: string;
          condition?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['item_kind'];
          location?: string | null;
          montaji_reg_no?: string | null;
          name: string;
          next_service_date?: string | null;
          pack_size?: number;
          reorder_level?: number;
          sell_price_minor?: number | null;
          unit?: string;
        };
        Update: {
          active?: boolean;
          assigned_to?: string | null;
          avg_unit_cost_minor?: number;
          business_id?: string;
          condition?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['item_kind'];
          location?: string | null;
          montaji_reg_no?: string | null;
          name?: string;
          next_service_date?: string | null;
          pack_size?: number;
          reorder_level?: number;
          sell_price_minor?: number | null;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_items_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      journal_entries: {
        Row: {
          branch_id: string | null;
          business_date: string;
          business_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          memo: string | null;
          source_id: string | null;
          source_type: string;
        };
        Insert: {
          branch_id?: string | null;
          business_date: string;
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          memo?: string | null;
          source_id?: string | null;
          source_type: string;
        };
        Update: {
          branch_id?: string | null;
          business_date?: string;
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          memo?: string | null;
          source_id?: string | null;
          source_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journal_entries_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_entries_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      journal_lines: {
        Row: {
          account_id: string;
          credit_minor: number;
          debit_minor: number;
          entry_id: string;
          id: string;
        };
        Insert: {
          account_id: string;
          credit_minor?: number;
          debit_minor?: number;
          entry_id: string;
          id?: string;
        };
        Update: {
          account_id?: string;
          credit_minor?: number;
          debit_minor?: number;
          entry_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journal_lines_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_lines_entry_id_fkey';
            columns: ['entry_id'];
            isOneToOne: false;
            referencedRelation: 'journal_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      member_branches: {
        Row: {
          branch_id: string;
          member_id: string;
        };
        Insert: {
          branch_id: string;
          member_id: string;
        };
        Update: {
          branch_id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_branches_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_branches_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      member_pins: {
        Row: {
          business_id: string;
          failed_count: number;
          locked_until: string | null;
          member_id: string;
          pin_hash: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          failed_count?: number;
          locked_until?: string | null;
          member_id: string;
          pin_hash: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          failed_count?: number;
          locked_until?: string | null;
          member_id?: string;
          pin_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_pins_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_pins_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: true;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      members: {
        Row: {
          active: boolean;
          business_id: string;
          created_at: string;
          default_branch_id: string | null;
          display_name: string;
          id: string;
          phone: string | null;
          role: Database['public']['Enums']['member_role'];
          user_id: string;
          username: string | null;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          created_at?: string;
          default_branch_id?: string | null;
          display_name: string;
          id?: string;
          phone?: string | null;
          role: Database['public']['Enums']['member_role'];
          user_id: string;
          username?: string | null;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          created_at?: string;
          default_branch_id?: string | null;
          display_name?: string;
          id?: string;
          phone?: string | null;
          role?: Database['public']['Enums']['member_role'];
          user_id?: string;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'members_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'members_default_branch_id_fkey';
            columns: ['default_branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          branch_id: string | null;
          business_id: string;
          created_at: string;
          data: NonNullable<Json>;
          dedupe_key: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          member_id: string;
          pushed_at: string | null;
          read_at: string | null;
          title: string;
          type: string;
        };
        Insert: {
          body: string;
          branch_id?: string | null;
          business_id: string;
          created_at?: string;
          data?: NonNullable<Json>;
          dedupe_key?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          member_id: string;
          pushed_at?: string | null;
          read_at?: string | null;
          title: string;
          type: string;
        };
        Update: {
          body?: string;
          branch_id?: string | null;
          business_id?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          dedupe_key?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          member_id?: string;
          pushed_at?: string | null;
          read_at?: string | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      payroll_adjustments: {
        Row: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          id: string;
          kind: string;
          method: Database['public']['Enums']['payment_method'] | null;
          note: string | null;
          period: string;
          reverse_reason: string | null;
          status: string;
        };
        Insert: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          id?: string;
          kind: string;
          method?: Database['public']['Enums']['payment_method'] | null;
          note?: string | null;
          period: string;
          reverse_reason?: string | null;
          status?: string;
        };
        Update: {
          amount_minor?: number;
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          id?: string;
          kind?: string;
          method?: Database['public']['Enums']['payment_method'] | null;
          note?: string | null;
          period?: string;
          reverse_reason?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payroll_adjustments_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_adjustments_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_adjustments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_adjustments_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      payroll_lines: {
        Row: {
          advances_minor: number;
          base_minor: number;
          bonus_minor: number;
          branch_id: string;
          business_id: string;
          commission_minor: number;
          deductions_minor: number;
          employee_id: string;
          id: string;
          net_minor: number;
          paid_at: string | null;
          paid_by: string | null;
          paid_method: Database['public']['Enums']['payment_method'] | null;
          run_id: string;
          wps_evidence_path: string | null;
          wps_status: string;
        };
        Insert: {
          advances_minor?: number;
          base_minor?: number;
          bonus_minor?: number;
          branch_id: string;
          business_id: string;
          commission_minor?: number;
          deductions_minor?: number;
          employee_id: string;
          id?: string;
          net_minor: number;
          paid_at?: string | null;
          paid_by?: string | null;
          paid_method?: Database['public']['Enums']['payment_method'] | null;
          run_id: string;
          wps_evidence_path?: string | null;
          wps_status?: string;
        };
        Update: {
          advances_minor?: number;
          base_minor?: number;
          bonus_minor?: number;
          branch_id?: string;
          business_id?: string;
          commission_minor?: number;
          deductions_minor?: number;
          employee_id?: string;
          id?: string;
          net_minor?: number;
          paid_at?: string | null;
          paid_by?: string | null;
          paid_method?: Database['public']['Enums']['payment_method'] | null;
          run_id?: string;
          wps_evidence_path?: string | null;
          wps_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payroll_lines_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_lines_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_lines_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_lines_paid_by_fkey';
            columns: ['paid_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_lines_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'payroll_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      payroll_runs: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          business_id: string;
          generated_at: string;
          generated_by: string | null;
          id: string;
          period: string;
          status: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          business_id: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          period: string;
          status?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          business_id?: string;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          period?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payroll_runs_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_runs_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_runs_generated_by_fkey';
            columns: ['generated_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      periods: {
        Row: {
          business_id: string;
          closed_at: string | null;
          closed_by: string | null;
          month: string;
          reopened_reason: string | null;
          status: string;
        };
        Insert: {
          business_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          month: string;
          reopened_reason?: string | null;
          status?: string;
        };
        Update: {
          business_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          month?: string;
          reopened_reason?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'periods_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'periods_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_events: {
        Row: {
          alerted_at: string | null;
          amount_minor: number | null;
          business_id: string;
          created_at: string;
          created_by: string | null;
          currency: string | null;
          id: string;
          kind: string;
          months: number | null;
          note: string | null;
          paid_until: string | null;
        };
        Insert: {
          alerted_at?: string | null;
          amount_minor?: number | null;
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          id?: string;
          kind: string;
          months?: number | null;
          note?: string | null;
          paid_until?: string | null;
        };
        Update: {
          alerted_at?: string | null;
          amount_minor?: number | null;
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          id?: string;
          kind?: string;
          months?: number | null;
          note?: string | null;
          paid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_events_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          bank_account_name: string | null;
          bank_iban: string | null;
          bank_name: string | null;
          bank_swift: string | null;
          currency: string;
          id: boolean;
          intl_currency: string;
          intl_price_per_branch_minor: number;
          pay_link_url: string | null;
          pay_note: string | null;
          price_per_branch_minor: number;
        };
        Insert: {
          bank_account_name?: string | null;
          bank_iban?: string | null;
          bank_name?: string | null;
          bank_swift?: string | null;
          currency?: string;
          id?: boolean;
          intl_currency?: string;
          intl_price_per_branch_minor?: number;
          pay_link_url?: string | null;
          pay_note?: string | null;
          price_per_branch_minor?: number;
        };
        Update: {
          bank_account_name?: string | null;
          bank_iban?: string | null;
          bank_name?: string | null;
          bank_swift?: string | null;
          currency?: string;
          id?: boolean;
          intl_currency?: string;
          intl_price_per_branch_minor?: number;
          pay_link_url?: string | null;
          pay_note?: string | null;
          price_per_branch_minor?: number;
        };
        Relationships: [];
      };
      purchase_bill_lines: {
        Row: {
          bill_id: string;
          description: string;
          id: string;
          item_id: string | null;
          packs: number | null;
          qty: number;
          total_minor: number;
          unit_cost_minor: number;
          unit_price_minor: number | null;
          update_stock: boolean;
          vat_minor: number;
        };
        Insert: {
          bill_id: string;
          description: string;
          id?: string;
          item_id?: string | null;
          packs?: number | null;
          qty: number;
          total_minor: number;
          unit_cost_minor: number;
          unit_price_minor?: number | null;
          update_stock?: boolean;
          vat_minor?: number;
        };
        Update: {
          bill_id?: string;
          description?: string;
          id?: string;
          item_id?: string | null;
          packs?: number | null;
          qty?: number;
          total_minor?: number;
          unit_cost_minor?: number;
          unit_price_minor?: number | null;
          update_stock?: boolean;
          vat_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_bill_lines_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'purchase_bills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_bill_lines_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
        ];
      };
      purchase_bills: {
        Row: {
          bill_date: string;
          branch_id: string;
          business_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string;
          id: string;
          invoice_ref: string | null;
          note: string | null;
          number: number;
          paid_minor: number;
          receipt_path: string | null;
          reverse_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          status: string;
          supplier_id: string;
          total_minor: number;
          vat_minor: number;
        };
        Insert: {
          bill_date: string;
          branch_id: string;
          business_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date: string;
          id?: string;
          invoice_ref?: string | null;
          note?: string | null;
          number: number;
          paid_minor?: number;
          receipt_path?: string | null;
          reverse_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: string;
          supplier_id: string;
          total_minor: number;
          vat_minor?: number;
        };
        Update: {
          bill_date?: string;
          branch_id?: string;
          business_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string;
          id?: string;
          invoice_ref?: string | null;
          note?: string | null;
          number?: number;
          paid_minor?: number;
          receipt_path?: string | null;
          reverse_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: string;
          supplier_id?: string;
          total_minor?: number;
          vat_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_bills_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_bills_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_bills_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_bills_reversed_by_fkey';
            columns: ['reversed_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_bills_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      push_deliveries: {
        Row: {
          body: string;
          created_at: string;
          detail: string | null;
          id: string;
          notification_id: string;
          status: string;
          ticket: string | null;
          title: string;
          token: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          notification_id: string;
          status: string;
          ticket?: string | null;
          title: string;
          token: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          notification_id?: string;
          status?: string;
          ticket?: string | null;
          title?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_deliveries_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          last_seen_at: string;
          member_id: string;
          platform: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          last_seen_at?: string;
          member_id: string;
          platform: string;
          token: string;
        };
        Update: {
          created_at?: string;
          last_seen_at?: string;
          member_id?: string;
          platform?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      refund_requests: {
        Row: {
          amount_minor: number;
          branch_id: string;
          business_id: string;
          created_at: string;
          handled_by: string | null;
          handled_note: string | null;
          id: string;
          reason: string;
          requested_by: string | null;
          sale_id: string;
          status: string;
        };
        Insert: {
          amount_minor: number;
          branch_id: string;
          business_id: string;
          created_at?: string;
          handled_by?: string | null;
          handled_note?: string | null;
          id?: string;
          reason: string;
          requested_by?: string | null;
          sale_id: string;
          status?: string;
        };
        Update: {
          amount_minor?: number;
          branch_id?: string;
          business_id?: string;
          created_at?: string;
          handled_by?: string | null;
          handled_note?: string | null;
          id?: string;
          reason?: string;
          requested_by?: string | null;
          sale_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'refund_requests_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refund_requests_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refund_requests_handled_by_fkey';
            columns: ['handled_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refund_requests_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refund_requests_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ];
      };
      refunds: {
        Row: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          idempotency_key: string | null;
          method: Database['public']['Enums']['payment_method'];
          reason: string;
          restock: boolean;
          sale_id: string;
          tip_minor: number;
        };
        Insert: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key?: string | null;
          method: Database['public']['Enums']['payment_method'];
          reason: string;
          restock?: boolean;
          sale_id: string;
          tip_minor?: number;
        };
        Update: {
          amount_minor?: number;
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key?: string | null;
          method?: Database['public']['Enums']['payment_method'];
          reason?: string;
          restock?: boolean;
          sale_id?: string;
          tip_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'refunds_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ];
      };
      rooms: {
        Row: {
          active: boolean;
          branch_id: string;
          business_id: string;
          id: string;
          kind: string;
          name: string;
        };
        Insert: {
          active?: boolean;
          branch_id: string;
          business_id: string;
          id?: string;
          kind?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          branch_id?: string;
          business_id?: string;
          id?: string;
          kind?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rooms_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rooms_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      rosters: {
        Row: {
          business_id: string;
          employee_id: string;
          end_time: string;
          start_time: string;
          weekday: number;
        };
        Insert: {
          business_id: string;
          employee_id: string;
          end_time: string;
          start_time: string;
          weekday: number;
        };
        Update: {
          business_id?: string;
          employee_id?: string;
          end_time?: string;
          start_time?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'rosters_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rosters_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      sale_counters: {
        Row: {
          branch_id: string;
          next_number: number;
        };
        Insert: {
          branch_id: string;
          next_number?: number;
        };
        Update: {
          branch_id?: string;
          next_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_counters_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: true;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      sale_lines: {
        Row: {
          commission_bps: number;
          commission_minor: number;
          discount_minor: number;
          employee_id: string | null;
          id: string;
          item_id: string | null;
          kind: Database['public']['Enums']['sale_line_kind'];
          name_snapshot: string;
          net_minor: number;
          qty: number;
          sale_id: string;
          service_id: string | null;
          unit_price_minor: number;
          vat_minor: number;
        };
        Insert: {
          commission_bps?: number;
          commission_minor?: number;
          discount_minor?: number;
          employee_id?: string | null;
          id?: string;
          item_id?: string | null;
          kind: Database['public']['Enums']['sale_line_kind'];
          name_snapshot: string;
          net_minor: number;
          qty: number;
          sale_id: string;
          service_id?: string | null;
          unit_price_minor: number;
          vat_minor?: number;
        };
        Update: {
          commission_bps?: number;
          commission_minor?: number;
          discount_minor?: number;
          employee_id?: string | null;
          id?: string;
          item_id?: string | null;
          kind?: Database['public']['Enums']['sale_line_kind'];
          name_snapshot?: string;
          net_minor?: number;
          qty?: number;
          sale_id?: string;
          service_id?: string | null;
          unit_price_minor?: number;
          vat_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_lines_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sale_lines_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sale_lines_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sale_lines_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      sale_payments: {
        Row: {
          amount_minor: number;
          id: string;
          method: Database['public']['Enums']['payment_method'];
          sale_id: string;
        };
        Insert: {
          amount_minor: number;
          id?: string;
          method: Database['public']['Enums']['payment_method'];
          sale_id: string;
        };
        Update: {
          amount_minor?: number;
          id?: string;
          method?: Database['public']['Enums']['payment_method'];
          sale_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_payments_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ];
      };
      sales: {
        Row: {
          appointment_id: string | null;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_name: string | null;
          deposit_applied_minor: number;
          discount_minor: number;
          employee_id: string | null;
          id: string;
          note: string | null;
          number: number;
          refunded_minor: number;
          status: Database['public']['Enums']['sale_status'];
          subtotal_minor: number;
          tax_inclusive: boolean;
          tax_rate_bps: number;
          tip_employee_id: string | null;
          tip_minor: number;
          total_minor: number;
          vat_minor: number;
          vat_mode: Database['public']['Enums']['vat_mode'];
        };
        Insert: {
          appointment_id?: string | null;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          deposit_applied_minor?: number;
          discount_minor?: number;
          employee_id?: string | null;
          id?: string;
          note?: string | null;
          number: number;
          refunded_minor?: number;
          status?: Database['public']['Enums']['sale_status'];
          subtotal_minor: number;
          tax_inclusive?: boolean;
          tax_rate_bps?: number;
          tip_employee_id?: string | null;
          tip_minor?: number;
          total_minor: number;
          vat_minor?: number;
          vat_mode: Database['public']['Enums']['vat_mode'];
        };
        Update: {
          appointment_id?: string | null;
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          deposit_applied_minor?: number;
          discount_minor?: number;
          employee_id?: string | null;
          id?: string;
          note?: string | null;
          number?: number;
          refunded_minor?: number;
          status?: Database['public']['Enums']['sale_status'];
          subtotal_minor?: number;
          tax_inclusive?: boolean;
          tax_rate_bps?: number;
          tip_employee_id?: string | null;
          tip_minor?: number;
          total_minor?: number;
          vat_minor?: number;
          vat_mode?: Database['public']['Enums']['vat_mode'];
        };
        Relationships: [
          {
            foreignKeyName: 'sales_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_tip_employee_id_fkey';
            columns: ['tip_employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      service_categories: {
        Row: {
          archived: boolean;
          business_id: string;
          created_at: string;
          icon: string;
          id: string;
          name: string;
          sort: number;
          translations: NonNullable<Json>;
        };
        Insert: {
          archived?: boolean;
          business_id: string;
          created_at?: string;
          icon?: string;
          id?: string;
          name: string;
          sort?: number;
          translations?: NonNullable<Json>;
        };
        Update: {
          archived?: boolean;
          business_id?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          name?: string;
          sort?: number;
          translations?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'service_categories_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      service_recipe_items: {
        Row: {
          item_id: string;
          qty: number;
          service_id: string;
        };
        Insert: {
          item_id: string;
          qty: number;
          service_id: string;
        };
        Update: {
          item_id?: string;
          qty?: number;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_recipe_items_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_recipe_items_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          buffer_min: number;
          business_id: string;
          category_id: string;
          created_at: string;
          duration_min: number | null;
          id: string;
          name: string;
          price_minor: number;
          requires_patch_test: boolean;
          requires_room: boolean;
          status: string;
          translations: NonNullable<Json>;
        };
        Insert: {
          buffer_min?: number;
          business_id: string;
          category_id: string;
          created_at?: string;
          duration_min?: number | null;
          id?: string;
          name: string;
          price_minor: number;
          requires_patch_test?: boolean;
          requires_room?: boolean;
          status?: string;
          translations?: NonNullable<Json>;
        };
        Update: {
          buffer_min?: number;
          business_id?: string;
          category_id?: string;
          created_at?: string;
          duration_min?: number | null;
          id?: string;
          name?: string;
          price_minor?: number;
          requires_patch_test?: boolean;
          requires_room?: boolean;
          status?: string;
          translations?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'services_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'service_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_counts: {
        Row: {
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          items_changed: number;
          items_counted: number;
          note: string | null;
          value_change_minor: number;
        };
        Insert: {
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          items_changed: number;
          items_counted: number;
          note?: string | null;
          value_change_minor: number;
        };
        Update: {
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          items_changed?: number;
          items_counted?: number;
          note?: string | null;
          value_change_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_counts_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_counts_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_counts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_levels: {
        Row: {
          branch_id: string;
          item_id: string;
          qty: number;
        };
        Insert: {
          branch_id: string;
          item_id: string;
          qty?: number;
        };
        Update: {
          branch_id?: string;
          item_id?: string;
          qty?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_levels_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_levels_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_movements: {
        Row: {
          branch_id: string;
          business_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          item_id: string;
          note: string | null;
          qty_delta: number;
          reason: Database['public']['Enums']['stock_reason'];
          ref_id: string | null;
          ref_type: string | null;
          unit_cost_minor: number;
        };
        Insert: {
          branch_id: string;
          business_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          item_id: string;
          note?: string | null;
          qty_delta: number;
          reason: Database['public']['Enums']['stock_reason'];
          ref_id?: string | null;
          ref_type?: string | null;
          unit_cost_minor?: number;
        };
        Update: {
          branch_id?: string;
          business_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          item_id?: string;
          note?: string | null;
          qty_delta?: number;
          reason?: Database['public']['Enums']['stock_reason'];
          ref_id?: string | null;
          ref_type?: string | null;
          unit_cost_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          business_id: string;
          paid_until: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          paid_until: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          paid_until?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: true;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      supplier_payments: {
        Row: {
          amount_minor: number;
          bill_id: string | null;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          method: Database['public']['Enums']['payment_method'];
          note: string | null;
          supplier_id: string;
        };
        Insert: {
          amount_minor: number;
          bill_id?: string | null;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          method: Database['public']['Enums']['payment_method'];
          note?: string | null;
          supplier_id: string;
        };
        Update: {
          amount_minor?: number;
          bill_id?: string | null;
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          method?: Database['public']['Enums']['payment_method'];
          note?: string | null;
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'supplier_payments_bill_id_fkey';
            columns: ['bill_id'];
            isOneToOne: false;
            referencedRelation: 'purchase_bills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'supplier_payments_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'supplier_payments_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'supplier_payments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'supplier_payments_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      suppliers: {
        Row: {
          active: boolean;
          business_id: string;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          terms_days: number;
          trn: string | null;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          terms_days?: number;
          trn?: string | null;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          terms_days?: number;
          trn?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'suppliers_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      tip_payouts: {
        Row: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref: string | null;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          id: string;
        };
        Insert: {
          amount_minor: number;
          branch_id: string;
          business_date: string;
          business_id: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          id?: string;
        };
        Update: {
          amount_minor?: number;
          branch_id?: string;
          business_date?: string;
          business_id?: string;
          client_ref?: string | null;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tip_payouts_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tip_payouts_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tip_payouts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tip_payouts_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      account_totals: {
        Args: { p_business: string; p_from?: string; p_to?: string };
        Returns: {
          account_id: string;
          code: string;
          credit_minor: number;
          debit_minor: number;
          name: string;
          system_key: string;
          type: Database['public']['Enums']['account_type'];
        }[];
      };
      acct: { Args: { p_business: string; p_key: string }; Returns: string };
      adjust_stock: { Args: { p: Json }; Returns: Json };
      admin_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active: boolean;
          business_id: string;
          confirmed: boolean;
          created_at: string;
          display_name: string;
          email: string;
          last_sign_in_at: string;
          platform_owner: boolean;
          provider: string;
          role: string;
          salon: string;
          user_id: string;
          username: string;
        }[];
      };
      admin_activate: {
        Args: { p_amount_minor: number; p_business: string; p_months: number; p_note: string };
        Returns: string;
      };
      admin_activity: {
        Args: { p_business?: string; p_limit?: number };
        Returns: {
          action: string;
          actor: string;
          business_id: string;
          created_at: string;
          entity_type: string;
          id: string;
          salon: string;
          summary: string;
        }[];
      };
      admin_close_salon: { Args: { p_business: string; p_note: string }; Returns: undefined };
      admin_end_plan: { Args: { p_business: string; p_note: string }; Returns: undefined };
      admin_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_plan_events: {
        Args: { p_limit?: number };
        Returns: {
          amount_minor: number;
          business_id: string;
          by_name: string;
          created_at: string;
          currency: string;
          id: string;
          kind: string;
          months: number;
          note: string;
          paid_until: string;
          salon: string;
        }[];
      };
      admin_salon_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          business_id: string;
          closed: boolean;
          currency: string;
          customers: number;
          last_sale_at: string;
          last_sign_in_at: string;
          mode: string;
          sales_30d: number;
          sales_month_minor: number;
          services: number;
          staff: number;
        }[];
      };
      admin_salons: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active: boolean;
          branches: number;
          business_id: string;
          code: string;
          country_code: string;
          created_at: string;
          name: string;
          owner_email: string;
          owner_name: string;
          paid_until: string;
          plan_currency: string;
          price_per_branch_minor: number;
          request_note: string;
          requested_at: string;
          requested_months: number;
          timezone: string;
        }[];
      };
      admin_set_payment_details: { Args: { p: Json }; Returns: undefined };
      admin_set_platform_owner: { Args: { p_email: string; p_on: boolean }; Returns: undefined };
      aed_rate: { Args: { p_currency: string }; Returns: number };
      allocate_minor: { Args: { p_total: number; p_weights: number[] }; Returns: number[] };
      appointment_for_update: {
        Args: { p_id: string };
        Returns: {
          branch_id: string;
          business_date: string;
          business_id: string;
          cancel_reason: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_name: string | null;
          deposit_method: Database['public']['Enums']['payment_method'] | null;
          deposit_minor: number;
          deposit_status: Database['public']['Enums']['deposit_status'];
          duration_min: number;
          employee_id: string | null;
          id: string;
          notes: string | null;
          room_id: string | null;
          sale_id: string | null;
          scheduled_at: string;
          source: Database['public']['Enums']['appointment_source'];
          started_at: string | null;
          status: Database['public']['Enums']['appointment_status'];
          updated_at: string;
          wait_notified_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'appointments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      approve_cash_closing: { Args: { p_id: string }; Returns: Json };
      approve_payroll: { Args: { p_run: string }; Returns: undefined };
      attach_document_evidence: {
        Args: { p_document: string; p_path: string };
        Returns: undefined;
      };
      attach_receipt: {
        Args: { p_id: string; p_kind: string; p_path: string };
        Returns: undefined;
      };
      attach_wps_evidence: { Args: { p_line: string; p_path: string }; Returns: undefined };
      attendance_day: {
        Args: { p_branch: string; p_date?: string };
        Returns: {
          break_minutes: number;
          break_started_at: string;
          clock_in: string;
          clock_out: string;
          colour: string;
          employee_id: string;
          full_name: string;
          late: boolean;
          late_minutes: number;
          role_title: string;
          shift_end: string;
          shift_start: string;
          status: string;
        }[];
      };
      available_slots: {
        Args: { p_branch: string; p_date: string; p_duration: number; p_employee?: string };
        Returns: {
          available: boolean;
          slot: string;
          starts_at: string;
        }[];
      };
      branch_business: { Args: { p_branch: string }; Returns: string };
      branch_setting: { Args: { p_branch: string; p_default: Json; p_key: string }; Returns: Json };
      branch_today: { Args: { p_branch: string }; Returns: string };
      branch_tz: { Args: { p_branch: string }; Returns: string };
      business_today: { Args: { p_business: string }; Returns: string };
      can_use_branch: { Args: { p_branch: string }; Returns: boolean };
      cancel_appointment: { Args: { p_id: string; p_reason: string }; Returns: string };
      cash_breakdown: {
        Args: { p_branch: string; p_date?: string };
        Returns: {
          amount_minor: number;
          entries: number;
          kind: string;
        }[];
      };
      change_country: { Args: { p: Json }; Returns: undefined };
      check_in: { Args: { p_id: string }; Returns: undefined };
      check_pin: { Args: { p_member: string; p_pin: string }; Returns: boolean };
      claim_plan_alerts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          admin_emails: string[];
          branches: number;
          code: string;
          country_code: string;
          currency: string;
          event_id: string;
          months: number;
          note: string;
          owner_email: string;
          owner_name: string;
          price_per_branch_minor: number;
          requested_at: string;
          salon: string;
        }[];
      };
      clock: { Args: { p: Json }; Returns: Json };
      close_period: { Args: { p_business: string; p_month: string }; Returns: undefined };
      closing_history: {
        Args: { p_branch: string; p_days?: number };
        Returns: {
          business_date: string;
          closing_id: string;
          counted_cash_minor: number;
          expected_cash_minor: number;
          reason: string;
          status: string;
          variance_minor: number;
        }[];
      };
      closing_preview: { Args: { p_branch: string; p_date?: string }; Returns: Json };
      commission_for: { Args: { p_employee: string; p_period: string }; Returns: number };
      compliance_readiness: { Args: { p_business: string }; Returns: number };
      compliance_status: {
        Args: { p_business: string };
        Returns: {
          branch_id: string;
          days_left: number;
          doc_type: string;
          document_id: string;
          employee_id: string;
          evidence_path: string;
          expires_on: string;
          holder_name: string;
          holder_type: string;
          issued_on: string;
          number: string;
          reminder_days: number;
          renewal_cost_minor: number;
          required: boolean;
          slot_key: string;
          status: string;
          version: number;
        }[];
      };
      compliance_template: {
        Args: { p_business: string };
        Returns: {
          doc_type: string;
          holder_type: string;
        }[];
      };
      configure_push: { Args: { p_anon_key: string; p_project_url: string }; Returns: undefined };
      convert_rough: { Args: { p_from: string; p_minor: number; p_to: string }; Returns: number };
      country_change_allowed: { Args: { p_business: string }; Returns: boolean };
      create_appointment: { Args: { p: Json }; Returns: string };
      create_business: { Args: { p: Json }; Returns: Json };
      create_sale: { Args: { p: Json }; Returns: Json };
      currency_decimals: { Args: { p_currency: string }; Returns: number };
      current_member_id: { Args: { p_business: string }; Returns: string };
      dashboard_today: { Args: { p_branch: string }; Returns: Json };
      delete_account_data: { Args: { p_user: string }; Returns: Json };
      dismiss_refund_request: { Args: { p_id: string; p_note: string }; Returns: undefined };
      dispatch_plan_alerts: { Args: Record<PropertyKey, never>; Returns: number };
      dispatch_push: { Args: Record<PropertyKey, never>; Returns: number };
      doc_label: { Args: { p_type: string }; Returns: string };
      employee_has_history: { Args: { p_id: string }; Returns: boolean };
      expected_cash: { Args: { p_branch: string; p_date?: string }; Returns: number };
      fmt_money: { Args: { p_currency?: string; p_minor: number }; Returns: string };
      generate_payroll: { Args: { p_business: string; p_period: string }; Returns: string };
      has_pin: { Args: { p_business: string }; Returns: boolean };
      has_role: {
        Args: { p_business: string; p_roles: Database['public']['Enums']['member_role'][] };
        Returns: boolean;
      };
      hygiene_items: { Args: Record<PropertyKey, never>; Returns: string[] };
      inventory_levels: {
        Args: { p_branch: string };
        Returns: {
          active: boolean;
          assigned_to: string;
          avg_unit_cost_minor: number;
          condition: string;
          item_id: string;
          kind: Database['public']['Enums']['item_kind'];
          last_movement_at: string;
          location: string;
          low: boolean;
          montaji_reg_no: string;
          movements_30d: number;
          name: string;
          next_service_date: string;
          qty: number;
          reorder_level: number;
          sell_price_minor: number;
          unit: string;
          value_minor: number;
        }[];
      };
      is_member: { Args: { p_business: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      log_access: { Args: { p_device: string; p_event: string }; Returns: undefined };
      mark_no_show: { Args: { p_id: string }; Returns: undefined };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      merge_duplicate_employees: { Args: Record<PropertyKey, never>; Returns: number };
      method_account: {
        Args: { p_method: Database['public']['Enums']['payment_method'] };
        Returns: string;
      };
      month_bounds: { Args: { p_month: string }; Returns: Record<string, unknown> };
      move_stock: {
        Args: {
          p_actor: string;
          p_branch: string;
          p_business: string;
          p_client_ref?: string;
          p_delta: number;
          p_item: string;
          p_note: string;
          p_reason: Database['public']['Enums']['stock_reason'];
          p_ref_id: string;
          p_ref_type: string;
        };
        Returns: Record<string, unknown>;
      };
      my_branch_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      my_business_ids: {
        Args: { p_roles: Database['public']['Enums']['member_role'][] };
        Returns: string[];
      };
      notify: {
        Args: {
          p_body: string;
          p_branch: string;
          p_business: string;
          p_data?: Json;
          p_dedupe?: string;
          p_entity_id?: string;
          p_entity_type?: string;
          p_roles: Database['public']['Enums']['member_role'][];
          p_title: string;
          p_type: string;
        };
        Returns: number;
      };
      notify_documents_due: { Args: { p_today?: string }; Returns: number };
      notify_long_waits: { Args: { p_now?: string }; Returns: number };
      owner_control: { Args: { p_branch: string }; Returns: Json };
      paid_from_account: {
        Args: { p_method: Database['public']['Enums']['payment_method'] };
        Returns: string;
      };
      pay_payroll_line: { Args: { p_line: string; p_method: string }; Returns: undefined };
      pay_supplier: { Args: { p: Json }; Returns: Json };
      pay_tips: { Args: { p: Json }; Returns: Json };
      period_list: {
        Args: { p_business: string };
        Returns: {
          closed_at: string;
          closed_by: string;
          entries: number;
          month: string;
          status: string;
        }[];
      };
      plan_active: { Args: { p_business: string }; Returns: boolean };
      plan_price: { Args: { p_business: string }; Returns: Record<string, unknown> };
      plan_status: { Args: { p_business: string }; Returns: Json };
      post_journal: {
        Args: {
          p_actor: string;
          p_branch: string;
          p_business: string;
          p_date: string;
          p_lines: Json;
          p_memo: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: string;
      };
      post_purchase_bill: { Args: { p: Json }; Returns: Json };
      post_stock_change: {
        Args: {
          p_actor: string;
          p_branch: string;
          p_business: string;
          p_gain: number;
          p_loss: number;
          p_memo: string;
          p_source: string;
          p_source_id: string;
        };
        Returns: undefined;
      };
      purchase_no: { Args: { p_number: number }; Returns: string };
      record_adjustment: { Args: { p: Json }; Returns: Json };
      record_expense: { Args: { p: Json }; Returns: Json };
      record_stock_count: { Args: { p: Json }; Returns: Json };
      refund_sale: { Args: { p: Json }; Returns: Json };
      register_push_token: {
        Args: { p_business: string; p_platform: string; p_token: string };
        Returns: undefined;
      };
      register_staff_member: { Args: { p: Json }; Returns: Json };
      remove_document_slot: { Args: { p: Json }; Returns: undefined };
      remove_staff: { Args: { p_actor: string; p_employee: string }; Returns: Json };
      rename_business: { Args: { p_business: string; p_name: string }; Returns: undefined };
      reopen_period: {
        Args: { p_business: string; p_month: string; p_reason: string };
        Returns: undefined;
      };
      report_closing: {
        Args: { p_branch: string; p_month: string };
        Returns: {
          approved_by: string;
          business_date: string;
          counted_by: string;
          counted_minor: number;
          expected_minor: number;
          reason: string;
          status: string;
          taken_out_minor: number;
          variance_minor: number;
        }[];
      };
      report_customers: {
        Args: { p_business: string; p_month: string };
        Returns: {
          created_at: string;
          customer_id: string;
          last_visit_at: string;
          month_spent_minor: number;
          month_visits: number;
          name: string;
          phone: string;
          spent_minor: number;
          visits: number;
        }[];
      };
      report_monthly: { Args: { p_branch: string; p_month: string }; Returns: Json };
      report_shortages: {
        Args: { p_branch: string; p_month: string };
        Returns: {
          approved_by: string;
          business_date: string;
          counted_by: string;
          reason: string;
          status: string;
          variance_minor: number;
        }[];
      };
      report_staff: {
        Args: { p_branch: string; p_month: string };
        Returns: {
          commission_minor: number;
          days_worked: number;
          employee_id: string;
          full_name: string;
          late_days: number;
          revenue_minor: number;
          sales_minor: number;
          services: number;
          tips_minor: number;
        }[];
      };
      report_stock: {
        Args: { p_branch: string; p_month: string };
        Returns: {
          closing: number;
          item_id: string;
          kind: Database['public']['Enums']['item_kind'];
          name: string;
          opening: number;
          qty_in: number;
          qty_out: number;
          unit: string;
          value_minor: number;
        }[];
      };
      report_vat: {
        Args: { p_branch: string; p_month: string };
        Returns: {
          entries: number;
          kind: string;
          taxable_minor: number;
          vat_minor: number;
        }[];
      };
      request_plan: {
        Args: { p_business: string; p_months: number; p_note: string };
        Returns: undefined;
      };
      request_refund: { Args: { p: Json }; Returns: string };
      require_member: {
        Args: { p_branch: string; p_roles: Database['public']['Enums']['member_role'][] };
        Returns: {
          active: boolean;
          business_id: string;
          created_at: string;
          default_branch_id: string | null;
          display_name: string;
          id: string;
          phone: string | null;
          role: Database['public']['Enums']['member_role'];
          user_id: string;
          username: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'members';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      require_plan: { Args: { p_business: string }; Returns: undefined };
      restore_document_slot: { Args: { p_removal: string }; Returns: undefined };
      restore_staff: { Args: { p_actor: string; p_employee: string }; Returns: Json };
      return_cash_closing: { Args: { p_id: string; p_reason: string }; Returns: Json };
      reverse_adjustment: { Args: { p_id: string; p_reason: string }; Returns: undefined };
      reverse_expense: { Args: { p_id: string; p_reason: string }; Returns: undefined };
      reverse_purchase_bill: { Args: { p_id: string; p_reason: string }; Returns: undefined };
      rostered: {
        Args: { p_date: string; p_employee: string; p_from: number; p_to: number };
        Returns: boolean;
      };
      save_document: { Args: { p: Json }; Returns: string };
      save_employee: { Args: { p: Json }; Returns: string };
      save_expense_category: { Args: { p: Json }; Returns: string };
      save_item: { Args: { p: Json }; Returns: string };
      save_service: { Args: { p: Json }; Returns: string };
      save_supplier: { Args: { p: Json }; Returns: string };
      seed_expense_categories: { Args: { p_business: string }; Returns: undefined };
      seed_mode_catalogue: {
        Args: {
          p_branch: string;
          p_business: string;
          p_mode: Database['public']['Enums']['salon_mode'];
        };
        Returns: undefined;
      };
      seed_system_accounts: { Args: { p_business: string }; Returns: undefined };
      send_daily_digests: { Args: { p_now?: string }; Returns: number };
      set_branch_mode: {
        Args: { p_branch: string; p_mode: Database['public']['Enums']['salon_mode'] };
        Returns: undefined;
      };
      set_my_pin: { Args: { p_business: string; p_pin: string }; Returns: undefined };
      set_opening_cash: { Args: { p_amount: number; p_branch: string }; Returns: undefined };
      set_opening_stock: { Args: { p_branch: string; p_items: Json }; Returns: undefined };
      set_roster: { Args: { p_days: Json; p_employee: string }; Returns: undefined };
      settle_deposit: {
        Args: {
          a: Database['public']['Tables']['appointments']['Row'];
          p_actor: string;
          p_outcome: string;
        };
        Returns: undefined;
      };
      shift_at: { Args: { p_employee: string; p_local: string }; Returns: Record<string, unknown> };
      shift_minutes: { Args: { p_end: string; p_start: string }; Returns: Record<string, unknown> };
      sign_hygiene_log: { Args: { p: Json }; Returns: string };
      staff_directory: {
        Args: { p_business: string };
        Returns: {
          active: boolean;
          base_salary_minor: number;
          branch_id: string;
          colour: string;
          commission_bps: number;
          employee_code: string;
          employee_id: string;
          full_name: string;
          member_id: string;
          phone: string;
          role_title: string;
          roster: Json;
          username: string;
          wps_required: boolean;
        }[];
      };
      staff_has_records: { Args: { p_employee: string }; Returns: boolean };
      start_service: { Args: { p_id: string }; Returns: undefined };
      starter_price: { Args: { p_aed_fils: number; p_currency: string }; Returns: number };
      submit_cash_count: { Args: { p: Json }; Returns: Json };
      supplier_balances: {
        Args: { p_business: string };
        Returns: {
          balance_minor: number;
          name: string;
          open_bills: number;
          overdue_minor: number;
          phone: string;
          supplier_id: string;
          terms_days: number;
        }[];
      };
      tips_owed: {
        Args: { p_branch: string };
        Returns: {
          employee_id: string;
          full_name: string;
          owed_minor: number;
        }[];
      };
      unclaim_plan_alert: { Args: { p_event: string }; Returns: undefined };
      undo_no_show: { Args: { p_id: string }; Returns: undefined };
      unique_business_code: { Args: { p_name: string }; Returns: string };
      unregister_push_token: { Args: { p_token: string }; Returns: undefined };
      update_branch: { Args: { p: Json; p_branch: string }; Returns: undefined };
      update_document: { Args: { p: Json }; Returns: undefined };
      update_my_profile: { Args: { p: Json }; Returns: undefined };
      wps_status: { Args: { p_business: string }; Returns: Json };
      write_audit: {
        Args: {
          p_action: string;
          p_actor: string;
          p_after?: Json;
          p_before?: Json;
          p_branch: string;
          p_business: string;
          p_entity_id: string;
          p_entity_type: string;
          p_summary: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
      appointment_source: 'walk_in' | 'phone' | 'staff' | 'app';
      appointment_status:
        'booked' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
      deposit_status: 'none' | 'held' | 'applied' | 'forfeited' | 'refunded';
      item_kind: 'consumable' | 'retail' | 'tool';
      member_role: 'owner' | 'cashier' | 'staff' | 'accountant';
      payment_method: 'cash' | 'card' | 'wallet' | 'bank';
      sale_line_kind: 'service' | 'retail' | 'custom';
      sale_status: 'completed' | 'partially_refunded' | 'refunded';
      salon_mode: 'gents' | 'ladies';
      stock_reason:
        | 'purchase'
        | 'service_use'
        | 'retail_sale'
        | 'adjustment'
        | 'count'
        | 'reversal'
        | 'opening';
      vat_mode: 'off' | 'on';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: ['asset', 'liability', 'equity', 'income', 'expense'],
      appointment_source: ['walk_in', 'phone', 'staff', 'app'],
      appointment_status: ['booked', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'],
      deposit_status: ['none', 'held', 'applied', 'forfeited', 'refunded'],
      item_kind: ['consumable', 'retail', 'tool'],
      member_role: ['owner', 'cashier', 'staff', 'accountant'],
      payment_method: ['cash', 'card', 'wallet', 'bank'],
      sale_line_kind: ['service', 'retail', 'custom'],
      sale_status: ['completed', 'partially_refunded', 'refunded'],
      salon_mode: ['gents', 'ladies'],
      stock_reason: [
        'purchase',
        'service_use',
        'retail_sale',
        'adjustment',
        'count',
        'reversal',
        'opening',
      ],
      vat_mode: ['off', 'on'],
    },
  },
} as const;
