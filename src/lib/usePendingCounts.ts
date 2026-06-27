import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type PendingCounts = {
  members: number
  payments: number
  withdrawals: number
  investments: number
  total: number
}

export function usePendingCounts() {
  return useQuery({
    queryKey: ['pending-counts'],
    refetchInterval: 30_000,
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
}
