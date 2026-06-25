import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  setSession: (session: Session | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  loading: true,

  setSession: (session) => set({ session }),

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    set({ profile: data, loading: false })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))
