import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight, Building2, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import AdCarousel from '../../components/AdCarousel'

export default function MemberDashboard() {
  const { profile } = useAuthStore()
  const [centerIndex, setCenterIndex] = useState(0)

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
        .select('type, amount, source, created_at')
        .eq('member_id', profile!.id)
      if (error) throw error
      return data
    },
  })

  const { data: centers } = useQuery({
    queryKey: ['dashboard-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_centers')
        .select('id, name, description, image_url, expected_return_pct, min_investment')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: announcements } = useQuery({
    queryKey: ['dashboard-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return data
    },
  })

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  // --- Real trends computed from transaction history ---
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  let creditsThisMonth = 0, debitsThisMonth = 0
  let creditsLastMonth = 0, debitsLastMonth = 0
  let netToday = 0
  let totalProfit = 0, profitThisMonth = 0, profitLastMonth = 0

  for (const tx of allTx ?? []) {
    const d = new Date(tx.created_at)
    const amt = Number(tx.amount)
    const isCredit = tx.type === 'credit'
    const isProfit = tx.source === 'profit'
    if (isProfit) {
      const signed = isCredit ? amt : -amt
      totalProfit += signed
      if (d >= startThisMonth) profitThisMonth += signed
      else if (d >= startLastMonth) profitLastMonth += signed
    }
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
  const profitTrend = pctChange(profitThisMonth, profitLastMonth)

  const fmtPct = (p: number | null) =>
    p === null ? 'New' : `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Welcome back,</p>
        <h1 className="text-xl font-semibold text-gray-100">{profile?.full_name}</h1>
      </div>

      {/* Stat cards with trends */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-5">
        {/* Current Balance */}
        <div className="col-span-2 rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-3 sm:rounded-2xl sm:p-5 xl:col-span-1">
          <div className="mb-2 flex items-center gap-2 sm:mb-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/20 sm:h-9 sm:w-9">
              <Wallet className="h-4 w-4 text-violet-300 sm:h-[18px] sm:w-[18px]" />
            </div>
            <p className="text-xs text-violet-200/80 sm:text-sm">Current Balance</p>
          </div>
          <p className="text-lg font-bold text-white sm:text-2xl">{fmt(Number(balance?.balance ?? 0))}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] sm:mt-2 sm:text-xs">
            <span className={netToday >= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {netToday >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {netToday >= 0 ? '+' : '-'}{fmt(Math.abs(netToday))}
            </span>
            <span className="text-gray-500">today</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent p-3 sm:rounded-2xl sm:p-5">
          <div className="mb-2 flex items-center gap-2 sm:mb-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-500/15 ring-1 ring-green-500/20 sm:h-9 sm:w-9">
              <TrendingUp className="h-4 w-4 text-green-300 sm:h-[18px] sm:w-[18px]" />
            </div>
            <p className="text-xs text-green-200/80 sm:text-sm">Total Profit</p>
          </div>
          <p className="text-lg font-bold text-green-300 sm:text-2xl">{fmt(totalProfit)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] sm:mt-2 sm:text-xs">
            <span className={(profitTrend ?? 0) >= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {(profitTrend ?? 0) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {fmtPct(profitTrend)}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        </div>

        {/* Total Credits */}
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-3 sm:rounded-2xl sm:p-5">
          <div className="mb-2 flex items-center gap-2 sm:mb-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-500/10 ring-1 ring-green-500/15 sm:h-9 sm:w-9">
              <TrendingUp className="h-4 w-4 text-green-400 sm:h-[18px] sm:w-[18px]" />
            </div>
            <p className="text-xs text-gray-400 sm:text-sm">Total Credits</p>
          </div>
          <p className="text-lg font-bold text-white sm:text-2xl">{fmt(Number(balance?.total_credits ?? 0))}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] sm:mt-2 sm:text-xs">
            <span className={(creditsTrend ?? 0) >= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {(creditsTrend ?? 0) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {fmtPct(creditsTrend)}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        </div>

        {/* Total Debits */}
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-3 sm:rounded-2xl sm:p-5">
          <div className="mb-2 flex items-center gap-2 sm:mb-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 ring-1 ring-red-500/15 sm:h-9 sm:w-9">
              <TrendingDown className="h-4 w-4 text-red-400 sm:h-[18px] sm:w-[18px]" />
            </div>
            <p className="text-xs text-gray-400 sm:text-sm">Total Debits</p>
          </div>
          <p className="text-lg font-bold text-white sm:text-2xl">{fmt(Number(balance?.total_debits ?? 0))}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] sm:mt-2 sm:text-xs">
            <span className={(debitsTrend ?? 0) <= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {(debitsTrend ?? 0) <= 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
              {fmtPct(debitsTrend)}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        </div>

        {/* Net This Month */}
        <div className="rounded-xl border border-gray-800 bg-[#141414] p-3 sm:rounded-2xl sm:p-5">
          <div className="mb-2 flex items-center gap-2 sm:mb-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/15 sm:h-9 sm:w-9">
              <BarChart3 className="h-4 w-4 text-violet-400 sm:h-[18px] sm:w-[18px]" />
            </div>
            <p className="text-xs text-gray-400 sm:text-sm">Net This Month</p>
          </div>
          <p className={netThisMonth >= 0 ? 'text-lg font-bold text-green-400 sm:text-2xl' : 'text-lg font-bold text-red-400 sm:text-2xl'}>
            {netThisMonth >= 0 ? '+' : '-'}{fmt(Math.abs(netThisMonth))}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] sm:mt-2 sm:text-xs">
            <span className={(netTrend ?? 0) >= 0 ? 'flex items-center gap-0.5 font-medium text-green-400' : 'flex items-center gap-0.5 font-medium text-red-400'}>
              {(netTrend ?? 0) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {fmtPct(netTrend)}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        </div>
      </div>

      {/* Advertisements */}
      <AdCarousel />

      {/* Investment Centers */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-400">Investment Center</h2>
          <Link to="/dashboard/investments" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
        </div>

        {(centers?.length ?? 0) === 0 ? (
          <Link to="/dashboard/investments" className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#141414] p-4 transition hover:border-violet-500/40">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Building2 size={22} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-200">Explore investments</p>
              <p className="text-xs text-gray-500">No centers available yet.</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-gray-600" />
          </Link>
        ) : (() => {
          const list = centers ?? []
          const idx = Math.min(centerIndex, list.length - 1)
          const c = list[idx]
          return (
            <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#141414]">
              {c.image_url
                ? <img src={c.image_url} alt={c.name} className="h-32 w-full object-cover" />
                : <div className="flex h-32 w-full items-center justify-center bg-[#0f0f0f] text-gray-700"><Building2 size={30} /></div>}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-100">{c.name}</p>
                    {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{c.description}</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1 text-green-400"><TrendingUp size={12} />{c.expected_return_pct}%</span>
                  <span>Min {fmt(Number(c.min_investment))}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link to="/dashboard/investments" className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 transition">View Details</Link>
                  {list.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCenterIndex((idx - 1 + list.length) % list.length)}
                        aria-label="Previous center"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-[#0f0f0f] text-gray-300 hover:border-violet-500/60 transition"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-[11px] text-gray-500">{idx + 1}/{list.length}</span>
                      <button
                        onClick={() => setCenterIndex((idx + 1) % list.length)}
                        aria-label="Next center"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-[#0f0f0f] text-gray-300 hover:border-violet-500/60 transition"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Announcements */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-400">Announcement</h2>
          <Link to="/dashboard/announcements" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
        </div>
        {(announcements?.length ?? 0) === 0 && <p className="text-sm text-gray-600">No announcements yet.</p>}
        <div className="space-y-2">
          {announcements?.map((a) => (
            <Link key={a.id} to="/dashboard/announcements" className="flex items-start gap-3 rounded-xl border border-gray-800 bg-[#141414] p-4 transition hover:border-violet-500/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-400"><Megaphone size={16} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-200">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{a.body}</p>
              </div>
              <span className="shrink-0 text-[11px] text-gray-600">{new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
