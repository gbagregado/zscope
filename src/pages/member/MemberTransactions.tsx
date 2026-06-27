import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function MemberTransactions() {
  const { profile } = useAuthStore()

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['member-transactions', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', profile!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-100">Transaction History</h1>

      {transactions?.length === 0 && <p className="text-sm text-gray-500">No transactions yet.</p>}

      <div className="space-y-2">
        {transactions?.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#141414] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${tx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {tx.type === 'credit' ? <TrendingUp size={16} className="text-green-400" /> : <TrendingDown size={16} className="text-red-400" />}
              </div>
              <div>
                <p className="text-sm text-gray-300">{tx.description}</p>
                <p className="text-xs text-gray-600">
                  {new Date(tx.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <p className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
              {tx.type === 'credit' ? '+' : '-'}{fmt(Number(tx.amount))}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
