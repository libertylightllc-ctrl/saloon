
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "access_history": {
                  Row: {
                    "business_id": string,"created_at": string,"device": string | null,"event": string,"id": string,"member_id": string | null
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"device"?: string | null,"event": string,"id"?: string,"member_id"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"device"?: string | null,"event"?: string,"id"?: string,"member_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_history_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_history_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"accounts": {
                  Row: {
                    "business_id": string,"code": string,"id": string,"name": string,"system_key": string | null,"type": Database["public"]['Enums']["account_type"]
                  }
                  Insert: {
                    "business_id": string,"code": string,"id"?: string,"name": string,"system_key"?: string | null,"type": Database["public"]['Enums']["account_type"]
                  }
                  Update: {
                    "business_id"?: string,"code"?: string,"id"?: string,"name"?: string,"system_key"?: string | null,"type"?: Database["public"]['Enums']["account_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_services": {
                  Row: {
                    "appointment_id": string,"duration_min": number,"employee_id": string | null,"id": string,"name_snapshot": string,"price_minor": number,"service_id": string
                  }
                  Insert: {
                    "appointment_id": string,"duration_min": number,"employee_id"?: string | null,"id"?: string,"name_snapshot": string,"price_minor": number,"service_id": string
                  }
                  Update: {
                    "appointment_id"?: string,"duration_min"?: number,"employee_id"?: string | null,"id"?: string,"name_snapshot"?: string,"price_minor"?: number,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_services_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_services_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_services_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "branch_id": string,"business_date": string,"business_id": string,"cancel_reason": string | null,"checked_in_at": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"customer_id": string | null,"customer_name": string | null,"deposit_method": Database["public"]['Enums']["payment_method"] | null,"deposit_minor": number,"deposit_status": Database["public"]['Enums']["deposit_status"],"duration_min": number,"employee_id": string | null,"id": string,"notes": string | null,"room_id": string | null,"sale_id": string | null,"scheduled_at": string,"source": Database["public"]['Enums']["appointment_source"],"started_at": string | null,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  Insert: {
                    "branch_id": string,"business_date": string,"business_id": string,"cancel_reason"?: string | null,"checked_in_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"deposit_minor"?: number,"deposit_status"?: Database["public"]['Enums']["deposit_status"],"duration_min"?: number,"employee_id"?: string | null,"id"?: string,"notes"?: string | null,"room_id"?: string | null,"sale_id"?: string | null,"scheduled_at": string,"source": Database["public"]['Enums']["appointment_source"],"started_at"?: string | null,"status": Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "branch_id"?: string,"business_date"?: string,"business_id"?: string,"cancel_reason"?: string | null,"checked_in_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"deposit_minor"?: number,"deposit_status"?: Database["public"]['Enums']["deposit_status"],"duration_min"?: number,"employee_id"?: string | null,"id"?: string,"notes"?: string | null,"room_id"?: string | null,"sale_id"?: string | null,"scheduled_at"?: string,"source"?: Database["public"]['Enums']["appointment_source"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_sale_fk"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"after": Json | null,"before": Json | null,"branch_id": string | null,"business_id": string,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"summary": string
                  }
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"branch_id"?: string | null,"business_id": string,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"summary": string
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"branch_id"?: string | null,"business_id"?: string,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_member_id_fkey"
      columns: ["actor_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "address": string | null,"business_id": string,"created_at": string,"id": string,"invoice_prefix": string | null,"mode": Database["public"]['Enums']["salon_mode"],"name": string,"opening_hours": NonNullable<Json>,"phone": string | null,"settings": NonNullable<Json>,"trn": string | null,"vat_mode": Database["public"]['Enums']["vat_mode"]
                  }
                  Insert: {
                    "address"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"invoice_prefix"?: string | null,"mode": Database["public"]['Enums']["salon_mode"],"name": string,"opening_hours"?: NonNullable<Json>,"phone"?: string | null,"settings"?: NonNullable<Json>,"trn"?: string | null,"vat_mode"?: Database["public"]['Enums']["vat_mode"]
                  }
                  Update: {
                    "address"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"invoice_prefix"?: string | null,"mode"?: Database["public"]['Enums']["salon_mode"],"name"?: string,"opening_hours"?: NonNullable<Json>,"phone"?: string | null,"settings"?: NonNullable<Json>,"trn"?: string | null,"vat_mode"?: Database["public"]['Enums']["vat_mode"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "branches_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "code": string,"country_code": string,"created_at": string,"created_by": string | null,"currency": string,"id": string,"is_demo": boolean,"name": string,"timezone": string
                  }
                  Insert: {
                    "code": string,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"is_demo"?: boolean,"name": string,"timezone"?: string
                  }
                  Update: {
                    "code"?: string,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"is_demo"?: boolean,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"last_visit_at": string | null,"marketing_opt_in": boolean,"name": string,"no_show_count": number,"notes": string | null,"phone": string | null,"preferences": string | null,"preferred_employee_id": string | null,"risk_flags": (string)[],"visit_count": number
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_visit_at"?: string | null,"marketing_opt_in"?: boolean,"name": string,"no_show_count"?: number,"notes"?: string | null,"phone"?: string | null,"preferences"?: string | null,"preferred_employee_id"?: string | null,"risk_flags"?: (string)[],"visit_count"?: number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_visit_at"?: string | null,"marketing_opt_in"?: boolean,"name"?: string,"no_show_count"?: number,"notes"?: string | null,"phone"?: string | null,"preferences"?: string | null,"preferred_employee_id"?: string | null,"risk_flags"?: (string)[],"visit_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_preferred_employee_id_fkey"
      columns: ["preferred_employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"employees": {
                  Row: {
                    "active": boolean,"branch_id": string,"business_id": string,"colour": string | null,"commission_bps": number,"created_at": string,"full_name": string,"id": string,"member_id": string | null,"role_title": string
                  }
                  Insert: {
                    "active"?: boolean,"branch_id": string,"business_id": string,"colour"?: string | null,"commission_bps"?: number,"created_at"?: string,"full_name": string,"id"?: string,"member_id"?: string | null,"role_title"?: string
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string,"business_id"?: string,"colour"?: string | null,"commission_bps"?: number,"created_at"?: string,"full_name"?: string,"id"?: string,"member_id"?: string | null,"role_title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employees_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employees_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employees_member_id_fkey"
      columns: ["member_id"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "account_id": string | null,"business_id": string,"id": string,"name": string
                  }
                  Insert: {
                    "account_id"?: string | null,"business_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "account_id"?: string | null,"business_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "active": boolean,"avg_unit_cost_minor": number,"business_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["item_kind"],"location": string | null,"name": string,"reorder_level": number,"sell_price_minor": number | null,"unit": string
                  }
                  Insert: {
                    "active"?: boolean,"avg_unit_cost_minor"?: number,"business_id": string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["item_kind"],"location"?: string | null,"name": string,"reorder_level"?: number,"sell_price_minor"?: number | null,"unit"?: string
                  }
                  Update: {
                    "active"?: boolean,"avg_unit_cost_minor"?: number,"business_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["item_kind"],"location"?: string | null,"name"?: string,"reorder_level"?: number,"sell_price_minor"?: number | null,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"journal_entries": {
                  Row: {
                    "branch_id": string | null,"business_date": string,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"memo": string | null,"source_id": string | null,"source_type": string
                  }
                  Insert: {
                    "branch_id"?: string | null,"business_date": string,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"memo"?: string | null,"source_id"?: string | null,"source_type": string
                  }
                  Update: {
                    "branch_id"?: string | null,"business_date"?: string,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"memo"?: string | null,"source_id"?: string | null,"source_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_entries_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"journal_lines": {
                  Row: {
                    "account_id": string,"credit_minor": number,"debit_minor": number,"entry_id": string,"id": string
                  }
                  Insert: {
                    "account_id": string,"credit_minor"?: number,"debit_minor"?: number,"entry_id": string,"id"?: string
                  }
                  Update: {
                    "account_id"?: string,"credit_minor"?: number,"debit_minor"?: number,"entry_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_lines_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_lines_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    }
                  ]
                },"member_branches": {
                  Row: {
                    "branch_id": string,"member_id": string
                  }
                  Insert: {
                    "branch_id": string,"member_id": string
                  }
                  Update: {
                    "branch_id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_branches_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_branches_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "active": boolean,"business_id": string,"created_at": string,"default_branch_id": string | null,"display_name": string,"id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string,"username": string | null
                  }
                  Insert: {
                    "active"?: boolean,"business_id": string,"created_at"?: string,"default_branch_id"?: string | null,"display_name": string,"id"?: string,"role": Database["public"]['Enums']["member_role"],"user_id": string,"username"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"business_id"?: string,"created_at"?: string,"default_branch_id"?: string | null,"display_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string,"username"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_default_branch_id_fkey"
      columns: ["default_branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"periods": {
                  Row: {
                    "business_id": string,"month": string,"status": string
                  }
                  Insert: {
                    "business_id": string,"month": string,"status"?: string
                  }
                  Update: {
                    "business_id"?: string,"month"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "periods_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_minor": number,"branch_id": string,"business_date": string,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"idempotency_key": string | null,"method": Database["public"]['Enums']["payment_method"],"reason": string,"restock": boolean,"sale_id": string
                  }
                  Insert: {
                    "amount_minor": number,"branch_id": string,"business_date": string,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"method": Database["public"]['Enums']["payment_method"],"reason": string,"restock"?: boolean,"sale_id": string
                  }
                  Update: {
                    "amount_minor"?: number,"branch_id"?: string,"business_date"?: string,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idempotency_key"?: string | null,"method"?: Database["public"]['Enums']["payment_method"],"reason"?: string,"restock"?: boolean,"sale_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "active": boolean,"branch_id": string,"business_id": string,"id": string,"kind": string,"name": string
                  }
                  Insert: {
                    "active"?: boolean,"branch_id": string,"business_id": string,"id"?: string,"kind"?: string,"name": string
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string,"business_id"?: string,"id"?: string,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rooms_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_counters": {
                  Row: {
                    "branch_id": string,"next_number": number
                  }
                  Insert: {
                    "branch_id": string,"next_number"?: number
                  }
                  Update: {
                    "branch_id"?: string,"next_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_counters_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: true
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_lines": {
                  Row: {
                    "commission_bps": number,"commission_minor": number,"discount_minor": number,"employee_id": string | null,"id": string,"item_id": string | null,"kind": Database["public"]['Enums']["sale_line_kind"],"name_snapshot": string,"net_minor": number,"qty": number,"sale_id": string,"service_id": string | null,"unit_price_minor": number,"vat_minor": number
                  }
                  Insert: {
                    "commission_bps"?: number,"commission_minor"?: number,"discount_minor"?: number,"employee_id"?: string | null,"id"?: string,"item_id"?: string | null,"kind": Database["public"]['Enums']["sale_line_kind"],"name_snapshot": string,"net_minor": number,"qty": number,"sale_id": string,"service_id"?: string | null,"unit_price_minor": number,"vat_minor"?: number
                  }
                  Update: {
                    "commission_bps"?: number,"commission_minor"?: number,"discount_minor"?: number,"employee_id"?: string | null,"id"?: string,"item_id"?: string | null,"kind"?: Database["public"]['Enums']["sale_line_kind"],"name_snapshot"?: string,"net_minor"?: number,"qty"?: number,"sale_id"?: string,"service_id"?: string | null,"unit_price_minor"?: number,"vat_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_lines_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_lines_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_lines_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_lines_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_payments": {
                  Row: {
                    "amount_minor": number,"id": string,"method": Database["public"]['Enums']["payment_method"],"sale_id": string
                  }
                  Insert: {
                    "amount_minor": number,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"sale_id": string
                  }
                  Update: {
                    "amount_minor"?: number,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"sale_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_payments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "appointment_id": string | null,"branch_id": string,"business_date": string,"business_id": string,"client_ref": string | null,"created_at": string,"created_by": string | null,"customer_id": string | null,"customer_name": string | null,"deposit_applied_minor": number,"discount_minor": number,"employee_id": string | null,"id": string,"note": string | null,"number": number,"refunded_minor": number,"status": Database["public"]['Enums']["sale_status"],"subtotal_minor": number,"tip_employee_id": string | null,"tip_minor": number,"total_minor": number,"vat_minor": number,"vat_mode": Database["public"]['Enums']["vat_mode"]
                  }
                  Insert: {
                    "appointment_id"?: string | null,"branch_id": string,"business_date": string,"business_id": string,"client_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"deposit_applied_minor"?: number,"discount_minor"?: number,"employee_id"?: string | null,"id"?: string,"note"?: string | null,"number": number,"refunded_minor"?: number,"status"?: Database["public"]['Enums']["sale_status"],"subtotal_minor": number,"tip_employee_id"?: string | null,"tip_minor"?: number,"total_minor": number,"vat_minor"?: number,"vat_mode": Database["public"]['Enums']["vat_mode"]
                  }
                  Update: {
                    "appointment_id"?: string | null,"branch_id"?: string,"business_date"?: string,"business_id"?: string,"client_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"deposit_applied_minor"?: number,"discount_minor"?: number,"employee_id"?: string | null,"id"?: string,"note"?: string | null,"number"?: number,"refunded_minor"?: number,"status"?: Database["public"]['Enums']["sale_status"],"subtotal_minor"?: number,"tip_employee_id"?: string | null,"tip_minor"?: number,"total_minor"?: number,"vat_minor"?: number,"vat_mode"?: Database["public"]['Enums']["vat_mode"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_tip_employee_id_fkey"
      columns: ["tip_employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"service_categories": {
                  Row: {
                    "archived": boolean,"business_id": string,"created_at": string,"icon": string,"id": string,"name": string,"sort": number,"translations": NonNullable<Json>
                  }
                  Insert: {
                    "archived"?: boolean,"business_id": string,"created_at"?: string,"icon"?: string,"id"?: string,"name": string,"sort"?: number,"translations"?: NonNullable<Json>
                  }
                  Update: {
                    "archived"?: boolean,"business_id"?: string,"created_at"?: string,"icon"?: string,"id"?: string,"name"?: string,"sort"?: number,"translations"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"service_recipe_items": {
                  Row: {
                    "item_id": string,"qty": number,"service_id": string
                  }
                  Insert: {
                    "item_id": string,"qty": number,"service_id": string
                  }
                  Update: {
                    "item_id"?: string,"qty"?: number,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_recipe_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_recipe_items_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "buffer_min": number,"business_id": string,"category_id": string,"created_at": string,"duration_min": number,"id": string,"name": string,"price_minor": number,"requires_patch_test": boolean,"requires_room": boolean,"status": string,"translations": NonNullable<Json>
                  }
                  Insert: {
                    "buffer_min"?: number,"business_id": string,"category_id": string,"created_at"?: string,"duration_min": number,"id"?: string,"name": string,"price_minor": number,"requires_patch_test"?: boolean,"requires_room"?: boolean,"status"?: string,"translations"?: NonNullable<Json>
                  }
                  Update: {
                    "buffer_min"?: number,"business_id"?: string,"category_id"?: string,"created_at"?: string,"duration_min"?: number,"id"?: string,"name"?: string,"price_minor"?: number,"requires_patch_test"?: boolean,"requires_room"?: boolean,"status"?: string,"translations"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "services_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "service_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_levels": {
                  Row: {
                    "branch_id": string,"item_id": string,"qty": number
                  }
                  Insert: {
                    "branch_id": string,"item_id": string,"qty"?: number
                  }
                  Update: {
                    "branch_id"?: string,"item_id"?: string,"qty"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_levels_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_levels_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "branch_id": string,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"item_id": string,"note": string | null,"qty_delta": number,"reason": Database["public"]['Enums']["stock_reason"],"ref_id": string | null,"ref_type": string | null,"unit_cost_minor": number
                  }
                  Insert: {
                    "branch_id": string,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"item_id": string,"note"?: string | null,"qty_delta": number,"reason": Database["public"]['Enums']["stock_reason"],"ref_id"?: string | null,"ref_type"?: string | null,"unit_cost_minor"?: number
                  }
                  Update: {
                    "branch_id"?: string,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"item_id"?: string,"note"?: string | null,"qty_delta"?: number,"reason"?: Database["public"]['Enums']["stock_reason"],"ref_id"?: string | null,"ref_type"?: string | null,"unit_cost_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "account_totals":
{ Args: { "p_business": string,"p_from"?: string,"p_to"?: string }; Returns: {
              "account_id": string,"code": string,"credit_minor": number,"debit_minor": number,"name": string,"system_key": string,"type": Database["public"]['Enums']["account_type"]
            }[]
                           },
"acct":
{ Args: { "p_business": string,"p_key": string }; Returns: string
                           },
"allocate_minor":
{ Args: { "p_total": number,"p_weights": (number)[] }; Returns: (number)[]
                           },
"appointment_for_update":
{ Args: { "p_id": string }; Returns: {
              "branch_id": string,
"business_date": string,
"business_id": string,
"cancel_reason": string | null,
"checked_in_at": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"customer_name": string | null,
"deposit_method": Database["public"]['Enums']["payment_method"] | null,
"deposit_minor": number,
"deposit_status": Database["public"]['Enums']["deposit_status"],
"duration_min": number,
"employee_id": string | null,
"id": string,
"notes": string | null,
"room_id": string | null,
"sale_id": string | null,
"scheduled_at": string,
"source": Database["public"]['Enums']["appointment_source"],
"started_at": string | null,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"available_slots":
{ Args: { "p_branch": string,"p_date": string,"p_duration": number,"p_employee"?: string }; Returns: {
              "available": boolean,"slot": string,"starts_at": string
            }[]
                           },
"branch_business":
{ Args: { "p_branch": string }; Returns: string
                           },
"branch_setting":
{ Args: { "p_branch": string,"p_default": Json,"p_key": string }; Returns: Json
                           },
"branch_today":
{ Args: { "p_branch": string }; Returns: string
                           },
"branch_tz":
{ Args: { "p_branch": string }; Returns: string
                           },
"can_use_branch":
{ Args: { "p_branch": string }; Returns: boolean
                           },
"cancel_appointment":
{ Args: { "p_id": string,"p_reason": string }; Returns: string
                           },
"cash_breakdown":
{ Args: { "p_branch": string,"p_date"?: string }; Returns: {
              "amount_minor": number,"entries": number,"kind": string
            }[]
                           },
"check_in":
{ Args: { "p_id": string }; Returns: undefined
                           },
"create_appointment":
{ Args: { "p": Json }; Returns: string
                           },
"create_business":
{ Args: { "p": Json }; Returns: Json
                           },
"create_sale":
{ Args: { "p": Json }; Returns: Json
                           },
"current_member_id":
{ Args: { "p_business": string }; Returns: string
                           },
"dashboard_today":
{ Args: { "p_branch": string }; Returns: Json
                           },
"expected_cash":
{ Args: { "p_branch": string,"p_date"?: string }; Returns: number
                           },
"fmt_money":
{ Args: { "p_currency"?: string,"p_minor": number }; Returns: string
                           },
"has_role":
{ Args: { "p_business": string,"p_roles": (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"is_member":
{ Args: { "p_business": string }; Returns: boolean
                           },
"log_access":
{ Args: { "p_device": string,"p_event": string }; Returns: undefined
                           },
"mark_no_show":
{ Args: { "p_id": string }; Returns: undefined
                           },
"method_account":
{ Args: { "p_method": Database["public"]['Enums']["payment_method"] }; Returns: string
                           },
"post_journal":
{ Args: { "p_actor": string,"p_branch": string,"p_business": string,"p_date": string,"p_lines": Json,"p_memo": string,"p_source_id": string,"p_source_type": string }; Returns: string
                           },
"refund_sale":
{ Args: { "p": Json }; Returns: Json
                           },
"register_staff_member":
{ Args: { "p": Json }; Returns: Json
                           },
"require_member":
{ Args: { "p_branch": string,"p_roles": (Database["public"]['Enums']["member_role"])[] }; Returns: {
              "active": boolean,
"business_id": string,
"created_at": string,
"default_branch_id": string | null,
"display_name": string,
"id": string,
"role": Database["public"]['Enums']["member_role"],
"user_id": string,
"username": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_service":
{ Args: { "p": Json }; Returns: string
                           },
"seed_mode_catalogue":
{ Args: { "p_branch": string,"p_business": string,"p_mode": Database["public"]['Enums']["salon_mode"] }; Returns: undefined
                           },
"seed_system_accounts":
{ Args: { "p_business": string }; Returns: undefined
                           },
"set_branch_mode":
{ Args: { "p_branch": string,"p_mode": Database["public"]['Enums']["salon_mode"] }; Returns: undefined
                           },
"set_opening_cash":
{ Args: { "p_amount": number,"p_branch": string }; Returns: undefined
                           },
"set_opening_stock":
{ Args: { "p_branch": string,"p_items": Json }; Returns: undefined
                           },
"settle_deposit":
{ Args: { "a": Database["public"]['Tables']["appointments"]['Row'],"p_actor": string,"p_outcome": string }; Returns: undefined
                           },
"start_service":
{ Args: { "p_id": string }; Returns: undefined
                           },
"unique_business_code":
{ Args: { "p_name": string }; Returns: string
                           },
"update_branch":
{ Args: { "p": Json,"p_branch": string }; Returns: undefined
                           },
"write_audit":
{ Args: { "p_action": string,"p_actor": string,"p_after"?: Json,"p_before"?: Json,"p_branch": string,"p_business": string,"p_entity_id": string,"p_entity_type": string,"p_summary": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_type": "asset"|"liability"|"equity"|"income"|"expense","appointment_source": "walk_in"|"phone"|"staff"|"app","appointment_status": "booked"|"waiting"|"in_progress"|"completed"|"cancelled"|"no_show","deposit_status": "none"|"held"|"applied"|"forfeited"|"refunded","item_kind": "consumable"|"retail"|"tool","member_role": "owner"|"cashier"|"staff"|"accountant","payment_method": "cash"|"card"|"wallet"|"bank","sale_line_kind": "service"|"retail"|"custom","sale_status": "completed"|"partially_refunded"|"refunded","salon_mode": "gents"|"ladies","stock_reason": "purchase"|"service_use"|"retail_sale"|"adjustment"|"count"|"reversal"|"opening","vat_mode": "off"|"on"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_type": ["asset", "liability", "equity", "income", "expense"],"appointment_source": ["walk_in", "phone", "staff", "app"],"appointment_status": ["booked", "waiting", "in_progress", "completed", "cancelled", "no_show"],"deposit_status": ["none", "held", "applied", "forfeited", "refunded"],"item_kind": ["consumable", "retail", "tool"],"member_role": ["owner", "cashier", "staff", "accountant"],"payment_method": ["cash", "card", "wallet", "bank"],"sale_line_kind": ["service", "retail", "custom"],"sale_status": ["completed", "partially_refunded", "refunded"],"salon_mode": ["gents", "ladies"],"stock_reason": ["purchase", "service_use", "retail_sale", "adjustment", "count", "reversal", "opening"],"vat_mode": ["off", "on"]
          }
        }
} as const

