import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

// ---- raw row types ----
type Tx = { id: string; member_id: string; type: 'credit' | 'debit'; amount: number; source: string; description: string | null; created_at: string }
type InvTx = { id: string; investment_id: string; type: 'deposit' | 'profit' | 'withdrawal' | 'reversal'; amount: number; created_at: string }
type InvBal = { investment_id: string; member_id: string; center_id: string; balance: number; total_deposits: number; total_profit: number; total_withdrawn: number }
type CenterRow = { id: string; name: string; image_url: string | null; fund_cap: number; expected_return_pct: number; is_active: boolean }
type Profile = { id: string; full_name: string; role: string; status: string }

export type Warning = { level: 'danger' | 'warn' | 'info'; text: string }
export type CenterPerf = {
  id: string; name: string; image_url: string | null; members: number
  raised: number; cap: number; capPct: number; profit: number; balance: number; expected_return_pct: number; is_active: boolean
}
export type TopMember = { id: string; name: string; invested: number; balance: number; profit: number; share: number }
export type Activity = { id: string; kind: 'deposit' | 'withdrawal' | 'profit' | 'invest' | 'pullout'; name: string; amount: number; when: string }
export type MonthPoint = { label: string; fundsIn: number; fundsOut: number; profit: number }

export type AdminMetrics = {
  walletTotal: number
  investmentBalance: number
  investedCapital: number
  fundsUnderMgmt: number
  investmentProfit: number
  walletProfit: number
  totalProfit: number
  totalMembers: number
  activeMembers: number
  pendingMembers: number
  pendingPayments: number
  pendingWithdrawals: number
  pendingJoins: number
  pendingPullouts: number
  pendingTotal: number
  monthly: MonthPoint[]
  thisMonth: MonthPoint
  lastMonth: MonthPoint
  fundsInPct: number | null
  fundsOutPct: number | null
  profitPct: number | null
  centers: CenterPerf[]
  capAlerts: CenterPerf[]
  topMembers: TopMember[]
  activity: Activity[]
  warnings: Warning[]
}

const pct = (cur: number, prev: number): number | null => {
  if (prev === 0) return cur === 0 ? 0 : null
  return ((cur - prev) / prev) * 100
}
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthLabel = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short' })

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async (): Promise<AdminMetrics> => {
      const [txR, invTxR, balR, centerR, profR, payR, wdR, joinR, pulloutR] = await Promise.all([
        supabase.from('transactions').select('id, member_id, type, amount, source, description, created_at'),
        supabase.from('investment_transactions').select('id, investment_id, type, amount, created_at'),
        supabase.from('investment_balances').select('investment_id, member_id, center_id, balance, total_deposits, total_profit, total_withdrawn'),
        supabase.from('investment_centers').select('id, name, image_url, fund_cap, expected_return_pct, is_active'),
        supabase.from('profiles').select('id, full_name, role, status'),
        supabase.from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('investment_join_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('investment_withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      for (const r of [txR, invTxR, balR, centerR, profR]) if (r.error) throw r.error

      const txs = (txR.data ?? []) as Tx[]
      const invTxs = (invTxR.data ?? []) as InvTx[]
      const bals = (balR.data ?? []) as InvBal[]
      const centers = (centerR.data ?? []) as CenterRow[]
      const profiles = (profR.data ?? []) as Profile[]
      const members = profiles.filter((p) => p.role === 'member')
      const nameById = new Map(profiles.map((p) => [p.id, p.full_name]))

      // ---- funds & profit ----
      const walletByMember = new Map<string, number>()
      for (const t of txs) {
        const cur = walletByMember.get(t.member_id) ?? 0
        walletByMember.set(t.member_id, cur + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)))
      }
      const walletTotal = [...walletByMember.values()].reduce((s, v) => s + Math.max(0, v), 0)
      const investmentBalance = bals.reduce((s, b) => s + Number(b.balance), 0)
      const investedCapital = bals.reduce((s, b) => s + Number(b.total_deposits) - Number(b.total_withdrawn), 0)
      const investmentProfit = bals.reduce((s, b) => s + Number(b.total_profit), 0)
      const walletProfit = txs.filter((t) => t.source === 'profit').reduce((s, t) => s + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)), 0)
      const totalProfit = investmentProfit + walletProfit
      const fundsUnderMgmt = walletTotal + investmentBalance

      // ---- members ----
      const totalMembers = members.length
      const activeMembers = members.filter((m) => m.status === 'active').length
      const pendingMembers = members.filter((m) => m.status === 'pending').length

      // ---- pending actions ----
      const pendingPayments = payR.count ?? 0
      const pendingWithdrawals = wdR.count ?? 0
      const pendingJoins = joinR.count ?? 0
      const pendingPullouts = pulloutR.count ?? 0
      const pendingTotal = pendingPayments + pendingWithdrawals + pendingJoins + pendingPullouts

      // ---- monthly money flow (last 6 months) ----
      const now = new Date()
      const buckets: { key: string; label: string; point: MonthPoint }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        buckets.push({ key: monthKey(d), label: monthLabel(d), point: { label: monthLabel(d), fundsIn: 0, fundsOut: 0, profit: 0 } })
      }
      const bucketByKey = new Map(buckets.map((b) => [b.key, b.point]))
      for (const t of txs) {
        const p = bucketByKey.get(monthKey(new Date(t.created_at)))
        if (!p) continue
        if (t.type === 'credit' && (t.source === 'payment_request' || t.source === 'manual')) p.fundsIn += Number(t.amount)
        if (t.type === 'debit' && t.source === 'withdrawal') p.fundsOut += Number(t.amount)
        if (t.source === 'profit') p.profit += t.type === 'credit' ? Number(t.amount) : -Number(t.amount)
      }
      for (const it of invTxs) {
        const p = bucketByKey.get(monthKey(new Date(it.created_at)))
        if (p && it.type === 'profit') p.profit += Number(it.amount)
      }
      const monthly = buckets.map((b) => b.point)
      const thisMonth = monthly[monthly.length - 1]
      const lastMonth = monthly[monthly.length - 2] ?? { label: '', fundsIn: 0, fundsOut: 0, profit: 0 }

      // ---- per-center performance ----
      const centerAgg = new Map<string, { members: number; deposits: number; withdrawn: number; profit: number; balance: number }>()
      for (const c of centers) centerAgg.set(c.id, { members: 0, deposits: 0, withdrawn: 0, profit: 0, balance: 0 })
      for (const b of bals) {
        const a = centerAgg.get(b.center_id); if (!a) continue
        a.members += 1
        a.deposits += Number(b.total_deposits)
        a.withdrawn += Number(b.total_withdrawn)
        a.profit += Number(b.total_profit)
        a.balance += Number(b.balance)
      }
      const centerPerf: CenterPerf[] = centers.map((c) => {
        const a = centerAgg.get(c.id)!
        const raised = a.deposits - a.withdrawn
        const cap = Number(c.fund_cap) || 0
        const capPct = cap > 0 ? Math.min(100, (raised / cap) * 100) : 0
        return { id: c.id, name: c.name, image_url: c.image_url, members: a.members, raised, cap, capPct, profit: a.profit, balance: a.balance, expected_return_pct: Number(c.expected_return_pct), is_active: c.is_active }
      }).sort((x, y) => y.balance - x.balance)
      const capAlerts = centerPerf.filter((c) => c.cap > 0 && c.capPct >= 90)

      // ---- top members by invested capital ----
      const memAgg = new Map<string, { invested: number; balance: number; profit: number }>()
      for (const b of bals) {
        const a = memAgg.get(b.member_id) ?? { invested: 0, balance: 0, profit: 0 }
        a.invested += Number(b.total_deposits) - Number(b.total_withdrawn)
        a.balance += Number(b.balance)
        a.profit += Number(b.total_profit)
        memAgg.set(b.member_id, a)
      }
      const totalInvestedAll = [...memAgg.values()].reduce((s, a) => s + a.invested, 0)
      const topMembers: TopMember[] = [...memAgg.entries()]
        .map(([id, a]) => ({ id, name: nameById.get(id) ?? 'Member', invested: a.invested, balance: a.balance, profit: a.profit, share: totalInvestedAll > 0 ? (a.invested / totalInvestedAll) * 100 : 0 }))
        .sort((x, y) => y.invested - x.invested)
        .slice(0, 8)

      // ---- recent activity (mixed feed) ----
      const invName = new Map(bals.map((b) => [b.investment_id, nameById.get(b.member_id) ?? 'Member']))
      const feed: Activity[] = []
      for (const t of txs) {
        if (t.source === 'payment_request' && t.type === 'credit') feed.push({ id: t.id, kind: 'deposit', name: nameById.get(t.member_id) ?? 'Member', amount: Number(t.amount), when: t.created_at })
        else if (t.source === 'withdrawal' && t.type === 'debit') feed.push({ id: t.id, kind: 'withdrawal', name: nameById.get(t.member_id) ?? 'Member', amount: Number(t.amount), when: t.created_at })
      }
      for (const it of invTxs) {
        if (it.type === 'profit') feed.push({ id: it.id, kind: 'profit', name: invName.get(it.investment_id) ?? 'Member', amount: Number(it.amount), when: it.created_at })
        else if (it.type === 'deposit') feed.push({ id: it.id, kind: 'invest', name: invName.get(it.investment_id) ?? 'Member', amount: Number(it.amount), when: it.created_at })
        else if (it.type === 'withdrawal') feed.push({ id: it.id, kind: 'pullout', name: invName.get(it.investment_id) ?? 'Member', amount: Number(it.amount), when: it.created_at })
      }
      const activity = feed.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()).slice(0, 12)

      // ---- warnings (drive the dynamic landing page) ----
      const warnings: Warning[] = []
      if (pendingMembers > 0) warnings.push({ level: 'info', text: `${pendingMembers} member${pendingMembers === 1 ? '' : 's'} awaiting approval` })
      if (pendingPayments > 0) warnings.push({ level: 'warn', text: `${pendingPayments} fund-in request${pendingPayments === 1 ? '' : 's'} to review` })
      if (pendingWithdrawals > 0) warnings.push({ level: 'warn', text: `${pendingWithdrawals} withdrawal${pendingWithdrawals === 1 ? '' : 's'} to process` })
      if (pendingJoins > 0) warnings.push({ level: 'warn', text: `${pendingJoins} investment join request${pendingJoins === 1 ? '' : 's'} pending` })
      if (pendingPullouts > 0) warnings.push({ level: 'warn', text: `${pendingPullouts} investment pull-out${pendingPullouts === 1 ? '' : 's'} pending` })
      for (const c of capAlerts) {
        warnings.push({ level: c.capPct >= 100 ? 'danger' : 'warn', text: c.capPct >= 100 ? `${c.name} has reached its fund cap` : `${c.name} is at ${c.capPct.toFixed(0)}% of its fund cap` })
      }

      return {
        walletTotal, investmentBalance, investedCapital, fundsUnderMgmt,
        investmentProfit, walletProfit, totalProfit,
        totalMembers, activeMembers, pendingMembers,
        pendingPayments, pendingWithdrawals, pendingJoins, pendingPullouts, pendingTotal,
        monthly, thisMonth, lastMonth,
        fundsInPct: pct(thisMonth.fundsIn, lastMonth.fundsIn),
        fundsOutPct: pct(thisMonth.fundsOut, lastMonth.fundsOut),
        profitPct: pct(thisMonth.profit, lastMonth.profit),
        centers: centerPerf, capAlerts, topMembers, activity, warnings,
      }
    },
  })
}

export const peso = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
export const pesoShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}
