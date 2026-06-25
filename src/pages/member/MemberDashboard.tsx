import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function MemberDashboard() {
  const { profile } = useAuthStore()

  const { data: balance } = useQuery({
    queryKey: ['member-balance', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_balances')
        .select('*')
        .eq('member_id', profile!.id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: recentTx } = useQuery({
    queryKey: ['member-recent-tx', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data
    },
  })

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Welcome back,</p>
        <h1 className="text-xl font-semibold text-gray-100">{profile?.full_name}</h1>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-violet-400" />
            <p className="text-xs text-violet-400">Current Balance</p>
          </div>
          <p className="text-2xl font-bold text-violet-300">{fmt(Number(balance?.balance ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-400" />
            <p className="text-xs text-gray-500">Total Credits</p>
          </div>
          <p className="text-lg font-semibold text-green-400">{fmt(Number(balance?.total_credits ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-400" />
            <p className="text-xs text-gray-500">Total Debits</p>
          </div>
          <p className="text-lg font-semibold text-red-400">{fmt(Number(balance?.total_debits ?? 0))}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/dashboard/add-funds" className="flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-[#141414] py-3 text-sm text-gray-300 hover:border-violet-500/50 hover:text-violet-300 transition-colors">
          <TrendingUp size={16} /> Add Funds
        </Link>
        <Link to="/dashboard/withdraw" className="flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-[#141414] py-3 text-sm text-gray-300 hover:border-violet-500/50 hover:text-violet-300 transition-colors">
          <TrendingDown size={16} /> Withdraw
        </Link>
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-400">Recent Transactions</h2>
          <Link to="/dashboard/transactions" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
        </div>
        {recentTx?.length === 0 && <p className="text-sm text-gray-600">No transactions yet.</p>}
        <div className="space-y-2">
          {recentTx?.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#141414] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tx.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {tx.type === 'credit' ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                </div>
                <div>
                  <p className="text-sm text-gray-300">{tx.description}</p>
                  <p className="text-xs text-gray-600">{new Date(tx.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
              <p className={`text-sm font-medium ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                {tx.type === 'credit' ? '+' : '-'}{fmt(Number(tx.amount))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
