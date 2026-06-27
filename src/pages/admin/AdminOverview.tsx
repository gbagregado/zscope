import { Link } from 'react-router-dom'
import { useAdminMetrics, peso, pesoShort } from '../../lib/useAdminMetrics'
import {
  Wallet, Landmark, TrendingUp, Users, AlertTriangle, ArrowUpRight, ArrowDownRight,
  ArrowDownToLine, ArrowUpFromLine, Building2, BarChart3, ChevronRight, CheckCircle2,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } from 'recharts'

export default function AdminOverview() {
  const { data: m, isLoading } = useAdminMetrics()

  if (isLoading || !m) return <div className="text-sm text-gray-500">Loading…</div>

  const pendingCards = [
    { n: m.pendingMembers, label: 'Member approvals', to: '/admin/members', icon: <Users size={16} /> },
    { n: m.pendingPayments, label: 'Fund-in requests', to: '/admin/payment-requests', icon: <ArrowDownToLine size={16} /> },
    { n: m.pendingWithdrawals, label: 'Withdrawals', to: '/admin/withdrawal-requests', icon: <ArrowUpFromLine size={16} /> },
    { n: m.pendingJoins + m.pendingPullouts, label: 'Investment requests', to: '/admin/investments', icon: <Landmark size={16} /> },
  ].filter((c) => c.n > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Overview</h1>
          <p className="mt-1 text-sm text-gray-500">Live snapshot of your platform.</p>
        </div>
        <Link to="/admin/reports" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition">
          <BarChart3 size={15} /> Full Reports
        </Link>
      </div>

      {/* Dynamic warnings / status */}
      {m.warnings.length > 0 ? (
        <div className="space-y-2">
          {m.warnings.map((w, i) => (
            <Link
              key={i}
              to={w.text.includes('member') ? '/admin/members' : w.text.includes('fund-in') ? '/admin/payment-requests' : w.text.includes('withdrawal') ? '/admin/withdrawal-requests' : w.text.includes('investment') ? '/admin/investments' : w.text.includes('cap') ? '/admin/investments' : '/admin/reports'}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                w.level === 'danger' ? 'border-red-500/25 bg-red-500/8 hover:bg-red-500/12'
                : w.level === 'warn' ? 'border-amber-500/25 bg-amber-500/8 hover:bg-amber-500/12'
                : 'border-violet-500/25 bg-violet-500/8 hover:bg-violet-500/12'}`}
            >
              <span className={`flex items-center gap-2 text-sm ${w.level === 'danger' ? 'text-red-300' : w.level === 'warn' ? 'text-amber-300' : 'text-violet-200'}`}>
                <AlertTriangle size={15} /> {w.text}
              </span>
              <ChevronRight size={16} className="shrink-0 text-gray-500" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/8 p-3.5 text-sm text-green-300">
          <CheckCircle2 size={16} /> All caught up — no pending actions or alerts.
        </div>
      )}

      {/* Headline KPIs with trend */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <TrendKpi icon={<Wallet size={15} />} label="Funds Under Management" value={peso(m.fundsUnderMgmt)} accent="violet" />
        <TrendKpi icon={<ArrowDownToLine size={15} />} label="Funds In (mo.)" value={peso(m.thisMonth.fundsIn)} pct={m.fundsInPct} good="up" />
        <TrendKpi icon={<TrendingUp size={15} />} label="Profit (mo.)" value={peso(m.thisMonth.profit)} pct={m.profitPct} good="up" accent="green" />
        <TrendKpi icon={<Users size={15} />} label="Active Members" value={`${m.activeMembers}`} sub={`${m.totalMembers} total`} />
      </div>

      {/* Money flow mini chart */}
      <section className="rounded-xl border border-gray-800 bg-[#141414] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Money Flow — 6 Months</h2>
          <Link to="/admin/reports" className="text-xs text-violet-400 hover:text-violet-300">Details</Link>
        </div>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.monthly} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#27272a' }} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f0f0f', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e4e4e7' }} formatter={(v, n) => [peso(Number(v)), n as string]} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="fundsIn" name="In" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="fundsOut" name="Out" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-[11px] text-gray-600">Green in · Red out · Violet profit · totals up to {pesoShort(m.thisMonth.fundsIn)} in this month</p>
      </section>

      {/* Pending action queue */}
      {pendingCards.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-300">Needs Your Action</h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {pendingCards.map((c) => (
              <Link key={c.label} to={c.to} className="rounded-xl border border-gray-800 bg-[#141414] p-3.5 transition hover:border-violet-500/50">
                <div className="flex items-center gap-1.5 text-gray-500">{c.icon}<span className="text-[11px]">{c.label}</span></div>
                <p className="mt-1.5 text-2xl font-semibold text-amber-400">{c.n}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top centers snapshot */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Top Centers by Funds</h2>
          <Link to="/admin/investments" className="text-xs text-violet-400 hover:text-violet-300">Manage</Link>
        </div>
        {m.centers.length === 0 && <p className="text-sm text-gray-600">No investment centers yet.</p>}
        <div className="space-y-2">
          {m.centers.slice(0, 4).map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#141414] p-3.5">
              {c.image_url
                ? <img src={c.image_url} alt={c.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400"><Building2 size={16} /></div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-200">{c.name}</p>
                <p className="text-[11px] text-gray-500">{c.members} member{c.members === 1 ? '' : 's'} · Profit <span className="text-green-400">{peso(c.profit)}</span></p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-100">{peso(c.balance)}</p>
                {c.cap > 0 && <p className={`text-[11px] ${c.capPct >= 100 ? 'text-red-400' : c.capPct >= 90 ? 'text-amber-400' : 'text-gray-500'}`}>{c.capPct.toFixed(0)}% of cap</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TrendKpi({ icon, label, value, sub, pct, good, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; pct?: number | null; good?: 'up' | 'down'; accent?: 'violet' | 'green' }) {
  const valueColor = accent === 'green' ? 'text-green-400' : accent === 'violet' ? 'text-violet-300' : 'text-gray-100'
  const isUp = (pct ?? 0) >= 0
  const positive = good === 'up' ? isUp : !isUp
  const trendColor = pct == null ? 'text-gray-500' : positive ? 'text-green-400' : 'text-red-400'
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-3.5">
      <div className="flex items-center gap-1.5 text-gray-500">{icon}<span className="text-[11px]">{label}</span></div>
      <p className={`mt-1.5 text-lg font-semibold ${valueColor}`}>{value}</p>
      {pct !== undefined ? (
        <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${trendColor}`}>
          {pct === null ? 'New this month' : <>{isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(pct).toFixed(0)}% vs last mo.</>}
        </p>
      ) : sub ? <p className="text-[11px] text-gray-600">{sub}</p> : null}
    </div>
  )
}
