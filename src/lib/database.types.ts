export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'member'
          status: 'pending' | 'active' | 'rejected'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: { role?: 'admin' | 'member'; status?: 'pending' | 'active' | 'rejected'; full_name?: string; email?: string }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          member_id: string
          type: 'credit' | 'debit'
          amount: number
          description: string
          created_by: string
          source: 'manual' | 'payment_request' | 'withdrawal' | 'profit'
          reference_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
        Relationships: []
      }
      payment_methods: {
        Row: {
          id: string
          name: string
          account_name: string
          account_number: string
          qr_image_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          name: string
          account_name: string
          account_number: string
          qr_image_url?: string | null
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['payment_methods']['Insert']>
        Relationships: []
      }
      payment_requests: {
        Row: {
          id: string
          member_id: string
          amount: number
          reference_number: string
          screenshot_url: string | null
          payment_method: string
          status: 'pending' | 'confirmed' | 'rejected'
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          member_id: string
          amount: number
          reference_number: string
          payment_method: string
          screenshot_url?: string | null
          status?: 'pending' | 'confirmed' | 'rejected'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['payment_requests']['Insert']>
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          id: string
          member_id: string
          amount: number
          member_payment_method: string
          member_account_name: string
          member_account_number: string
          status: 'pending' | 'approved' | 'rejected'
          reference_number: string | null
          proof_url: string | null
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          member_id: string
          amount: number
          member_payment_method: string
          member_account_name: string
          member_account_number: string
          status?: 'pending' | 'approved' | 'rejected'
          reference_number?: string | null
          proof_url?: string | null
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['withdrawal_requests']['Insert']>
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          title: string
          body: string
          image_url: string | null
          storage_path: string | null
          show_as_popup: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          title: string
          body: string
          image_url?: string | null
          storage_path?: string | null
          show_as_popup?: boolean
          created_by: string
        }
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>
        Relationships: []
      }
      advertisements: {
        Row: {
          id: string
          image_url: string
          storage_path: string | null
          sort_order: number
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          image_url: string
          storage_path?: string | null
          sort_order?: number
          is_active?: boolean
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['advertisements']['Insert']>
        Relationships: []
      }
      investment_centers: {
        Row: {
          id: string
          name: string
          description: string | null
          image_url: string | null
          storage_path: string | null
          expected_return_pct: number
          min_investment: number
          maintaining_balance: number
          fund_cap: number
          max_per_member: number
          lock_in_months: number
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          name: string
          description?: string | null
          image_url?: string | null
          storage_path?: string | null
          expected_return_pct?: number
          min_investment?: number
          maintaining_balance?: number
          fund_cap?: number
          max_per_member?: number
          lock_in_months?: number
          is_active?: boolean
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['investment_centers']['Insert']>
        Relationships: []
      }
      investments: {
        Row: {
          id: string
          member_id: string
          center_id: string
          status: 'active' | 'closed'
          created_at: string
        }
        Insert: {
          member_id: string
          center_id: string
          status?: 'active' | 'closed'
        }
        Update: Partial<Database['public']['Tables']['investments']['Insert']>
        Relationships: []
      }
      investment_transactions: {
        Row: {
          id: string
          investment_id: string
          type: 'deposit' | 'profit' | 'withdrawal' | 'reversal'
          amount: number
          description: string | null
          created_by: string | null
          reverses_id: string | null
          created_at: string
        }
        Insert: {
          investment_id: string
          type: 'deposit' | 'profit' | 'withdrawal' | 'reversal'
          amount: number
          description?: string | null
          created_by?: string | null
          reverses_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['investment_transactions']['Insert']>
        Relationships: []
      }
      investment_join_requests: {
        Row: {
          id: string
          member_id: string
          center_id: string
          amount: number
          status: 'pending' | 'approved' | 'rejected'
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          member_id: string
          center_id: string
          amount: number
          status?: 'pending' | 'approved' | 'rejected'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['investment_join_requests']['Insert']>
        Relationships: []
      }
      investment_withdrawal_requests: {
        Row: {
          id: string
          investment_id: string
          member_id: string
          amount: number
          status: 'pending' | 'approved' | 'rejected'
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          investment_id: string
          member_id: string
          amount: number
          status?: 'pending' | 'approved' | 'rejected'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['investment_withdrawal_requests']['Insert']>
        Relationships: []
      }
    }
    Views: {
      member_balances: {
        Row: {
          member_id: string
          full_name: string
          email: string
          total_credits: number
          total_debits: number
          balance: number
        }
        Relationships: []
      }
      investment_balances: {
        Row: {
          investment_id: string
          member_id: string
          center_id: string
          status: 'active' | 'closed'
          created_at: string
          balance: number
          total_deposits: number
          total_profit: number
          total_withdrawn: number
        }
        Relationships: []
      }
    }
    Functions: {
      approve_investment_join: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      add_investment_profit: {
        Args: { p_investment_id: string; p_amount: number; p_note: string }
        Returns: undefined
      }
      approve_investment_withdrawal: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      reverse_wallet_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      reverse_investment_transaction: {
        Args: { p_tx_id: string }
        Returns: undefined
      }
    }
  }
}
