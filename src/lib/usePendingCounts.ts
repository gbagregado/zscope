import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type PendingCounts = {
  members: number
  payments: number
  withdrawals: number
  investments: number
  total: number
}

// Tables whose inserts/updates affect the pending badges.
const WATCH_TABLES = [
  'profiles',
  'payment_requests',
  'withdrawal_requests',
  'investment_join_requests',
  'investment_withdrawal_requests',
]

export function usePendingCounts() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['pending-counts'],
    // Realtime drives updates; keep a slow poll as a safety net.
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<PendingCounts> => {
      const [memR, payR, wdR, joinR, pulloutR] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member').eq('status', 'pending'),
        supabase.from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('investment_join_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('investment_withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      const members = memR.count ?? 0
      const payments = payR.count ?? 0
      const withdrawals = wdR.count ?? 0
      const investments = (joinR.count ?? 0) + (pulloutR.count ?? 0)
      return { members, payments, withdrawals, investments, total: members + payments + withdrawals + investments }
    },
  })

  useEffect(() => {
    const channel = supabase.channel('pending-counts')
    for (const table of WATCH_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        qc.invalidateQueries({ queryKey: ['pending-counts'] })
        qc.invalidateQueries({ queryKey: ['admin-metrics'] })
      })
    }
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  return query
}
