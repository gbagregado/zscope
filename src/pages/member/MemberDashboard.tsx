import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import AdCarousel from '../../components/AdCarousel'

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

  const { data: allTx } = useQuery({
    queryKey: ['member-all-tx', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, created_at')
        .eq('member_id', profile!.id)
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

  // --- Real trends computed from transaction history ---
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  let creditsThisMonth = 0, debitsThisMonth = 0
  let creditsLastMonth = 0, debitsLastMonth = 0
  let netToday = 0

  for (const tx of allTx ?? []) {
    const d = new Date(tx.created_at)
    const amt = Number(tx.amount)
    const isCredit = tx.type === 'credit'
    if (d >= startThisMonth) {
      if (isCredit) creditsThisMonth += amt; else debitsThisMonth += amt
    } else if (d >= startLastMonth) {
      if (isCredit) creditsLastMonth += amt; else debitsLastMonth += amt
    }
    if (d >= startToday) netToday += isCredit ? amt : -amt
  }

  const netThisMonth = creditsThisMonth - debitsThisMonth
  const netLastMonth = creditsLastMonth - debitsLastMonth

  const pctChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current === 0 ? 0 : null
    return ((current - previous) / Math.abs(previous)) * 100
  }

  const creditsTrend = pctChange(creditsThisMonth, creditsLastMonth)
  const debitsTrend = pctChange(debitsThisMonth, debitsLastMonth)
  const netTrend = pctChange(netThisMonth, netLastMonth)

  const fmtPct = (p: number | null) =>
    p === null ? 'New' : `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Welcome back,</p>
        <h1 className="text-xl font-semibold text-gray-100">{profile?.full_name}</h1>
      </div>

      {/* Stat cards with trends */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Current Balance */}
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/20">
              <Wallet size={18} className="text-violet-300" />
            </div>
            <p className="text-sm text-violet-200/80">Current Balance</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(Number(balance?.balance ?? 0))}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className={netToday >= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {netToday >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {netToday >= 0 ? '+' : '-'}{fmt(Math.abs(netToday))}
            </span>
            <span className="text-gray-500">today</span>
          </div>
        </div>

        {/* Total Credits */}
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 ring-1 ring-green-500/15">
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <p className="text-sm text-gray-400">Total Credits</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(Number(balance?.total_credits ?? 0))}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className={(creditsTrend ?? 0) >= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {(creditsTrend ?? 0) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {fmtPct(creditsTrend)}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        </div>

        {/* Total Debits */}
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 ring-1 ring-red-500/15">
              <TrendingDown size={18} className="text-red-400" />
            </div>
            <p className="text-sm text-gray-400">Total Debits</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(Number(balance?.total_debits ?? 0))}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className={(debitsTrend ?? 0) <= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {(debitsTrend ?? 0) <= 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
              {fmtPct(debitsTrend)}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        </div>

        {/* Net This Month */}
        <div className="rounded-2xl border border-gray-800 bg-[#141414] p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/15">
              <BarChart3 size={18} className="text-violet-400" />
            </div>
            <p className="text-sm text-gray-400">Net This Month</p>
          </div>
          <p className={netThisMonth >= 0 ? 'text-2xl font-bold text-green-400' : 'text-2xl font-bold text-red-400'}>
            {netThisMonth >= 0 ? '+' : '-'}{fmt(Math.abs(netThisMonth))}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className={(netTrend ?? 0) >= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {(netTrend ?? 0) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {fmtPct(netTrend)}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
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

      {/* Advertisements */}
      <AdCarousel />

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
