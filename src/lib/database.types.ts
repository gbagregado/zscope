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
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          member_id: string
          type: 'credit' | 'debit'
          amount: number
          description: string
          created_by: string
          source: 'manual' | 'payment_request' | 'withdrawal'
          reference_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['payment_methods']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payment_methods']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['payment_requests']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payment_requests']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['withdrawal_requests']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['withdrawal_requests']['Insert']>
      }
      announcements: {
        Row: {
          id: string
          title: string
          body: string
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['announcements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>
      }
    }
  }
}
