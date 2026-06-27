import { useAdminMetrics, peso, pesoShort, type CenterPerf, type TopMember, type Activity } from '../../lib/useAdminMetrics'
import {
  Wallet, Landmark, TrendingUp, PiggyBank, Users, ArrowDownToLine, ArrowUpFromLine,
  Building2, Download, AlertTriangle, ArrowDownRight, ArrowUpRight, Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts'

const fmtDateTime = (s: string) => new Date(s).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminReports() {
  const { data: m, isLoading } = useAdminMetrics()

  if (isLoading || !m) return <div className="text-sm text-gray-500">Loading report…</div>

  function exportCenters() {
    downloadCsv('investment-centers-report.csv', [
      ['Center', 'Status', 'Members', 'Raised', 'Fund Cap', 'Cap %', 'Current Funds', 'Profit', 'Expected Return %'],
      ...m!.centers.map((c) => [c.name, c.is_active ? 'Active' : 'Locked', c.members, c.raised.toFixed(2), c.cap > 0 ? c.cap.toFixed(2) : 'Unlimited', c.cap > 0 ? c.capPct.toFixed(1) : '—', c.balance.toFixed(2), c.profit.toFixed(2), c.expected_return_pct]),
    ])
  }
  function exportMembers() {
    downloadCsv('top-members-report.csv', [
      ['Member', 'Invested Capital', 'Current Balance', 'Profit', 'Share %'],
      ...m!.topMembers.map((t) => [t.name, t.invested.toFixed(2), t.balance.toFixed(2), t.profit.toFixed(2), t.share.toFixed(1)]),
    ])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Full overview of funds, investments, members, and profit.</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={<Wallet size={15} />} label="Funds Under Management" value={peso(m.fundsUnderMgmt)} accent="violet" />
        <Kpi icon={<Landmark size={15} />} label="Invested Capital" value={peso(m.investedCapital)} />
        <Kpi icon={<TrendingUp size={15} />} label="Total Profit Paid" value={peso(m.totalProfit)} accent="green" />
        <Kpi icon={<PiggyBank size={15} />} label="Idle Wallet Cash" value={peso(m.walletTotal)} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={<Users size={15} />} label="Active Members" value={`${m.activeMembers}`} sub={`${m.totalMembers} total`} />
        <Kpi icon={<Landmark size={15} />} label="Investment Funds" value={peso(m.investmentBalance)} />
        <Kpi icon={<Sparkles size={15} />} label="Pending Approvals" value={`${m.pendingMembers}`} sub="members" />
        <Kpi icon={<AlertTriangle size={15} />} label="Action Items" value={`${m.pendingTotal}`} sub="to review" accent={m.pendingTotal > 0 ? 'amber' : undefined} />
      </div>

      {/* Money flow this month vs last */}
      <section className="rounded-xl border border-gray-800 bg-[#141414] p-4">
        <h2 className="text-sm font-semibold text-gray-300">Money Flow — This Month vs Last</h2>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Delta label="Funds In" value={peso(m.thisMonth.fundsIn)} pct={m.fundsInPct} good="up" />
          <Delta label="Funds Out" value={peso(m.thisMonth.fundsOut)} pct={m.fundsOutPct} good="down" />
          <Delta label="Profit Distributed" value={peso(m.thisMonth.profit)} pct={m.profitPct} good="up" />
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.monthly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#27272a' }} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => pesoShort(Number(v))} />
              <Tooltip contentStyle={{ background: '#0f0f0f', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e4e4e7' }} formatter={(v, n) => [peso(Number(v)), n as string]} cursor={{ fill: '#ffffff08' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fundsIn" name="Funds In" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="fundsOut" name="Funds Out" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Profit trend */}
      <section className="rounded-xl border border-gray-800 bg-[#141414] p-4">
        <h2 className="text-sm font-semibold text-gray-300">Profit Distributed — Last 6 Months</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={m.monthly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#27272a' }} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => pesoShort(Number(v))} />
              <Tooltip contentStyle={{ background: '#0f0f0f', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e4e4e7' }} formatter={(v) => [peso(Number(v)), 'Profit']} cursor={{ stroke: '#3f3f46' }} />
              <Area type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} fill="url(#profitFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Per-center performance */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Investment Center Performance</h2>
          <button onClick={exportCenters} className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500/60 hover:text-white transition"><Download size={13} /> CSV</button>
        </div>
        {m.centers.length === 0 && <p className="text-sm text-gray-600">No investment centers yet.</p>}
        <div className="space-y-2">
          {m.centers.map((c) => <CenterRowCard key={c.id} c={c} />)}
        </div>
      </section>

      {/* Fund cap utilization */}
      {m.capAlerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-300"><AlertTriangle size={15} /> Fund Cap Alerts</h2>
          {m.capAlerts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="truncate text-sm font-medium text-gray-200">{c.name}</p>
              <p className="shrink-0 text-xs font-medium text-amber-400">{peso(c.raised)} / {peso(c.cap)} ({c.capPct.toFixed(0)}%)</p>
            </div>
          ))}
        </section>
      )}

      {/* Top members */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Top Investors</h2>
          <button onClick={exportMembers} className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500/60 hover:text-white transition"><Download size={13} /> CSV</button>
        </div>
        {m.topMembers.length === 0 && <p className="text-sm text-gray-600">No investments yet.</p>}
        <div className="space-y-2">
          {m.topMembers.map((t, i) => <TopMemberRow key={t.id} t={t} rank={i + 1} />)}
        </div>
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Recent Activity</h2>
        {m.activity.length === 0 && <p className="text-sm text-gray-600">No activity yet.</p>}
        <div className="space-y-1.5">
          {m.activity.map((a) => <ActivityRow key={a.id} a={a} />)}
        </div>
      </section>
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: 'violet' | 'green' | 'amber' }) {
  const valueColor = accent === 'green' ? 'text-green-400' : accent === 'amber' ? 'text-amber-400' : accent === 'violet' ? 'text-violet-300' : 'text-gray-100'
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-3.5">
      <div className="flex items-center gap-1.5 text-gray-500">{icon}<span className="text-[11px]">{label}</span></div>
      <p className={`mt-1.5 text-lg font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600">{sub}</p>}
    </div>
  )
}

function Delta({ label, value, pct, good }: { label: string; value: string; pct: number | null; good: 'up' | 'down' }) {
  const isUp = (pct ?? 0) >= 0
  const positive = good === 'up' ? isUp : !isUp
  const color = pct === null ? 'text-gray-500' : positive ? 'text-green-400' : 'text-red-400'
  return (
    <div className="rounded-lg bg-[#0f0f0f] p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-gray-100">{value}</p>
      <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${color}`}>
        {pct === null ? 'New' : <>{isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(pct).toFixed(0)}% vs last month</>}
      </p>
    </div>
  )
}

function CenterRowCard({ c }: { c: CenterPerf }) {
  const barColor = c.capPct >= 100 ? 'bg-red-500' : c.capPct >= 90 ? 'bg-amber-500' : 'bg-violet-500'
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-4">
      <div className="flex items-center gap-3">
        {c.image_url
          ? <img src={c.image_url} alt={c.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400"><Building2 size={16} /></div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-100">{c.name}</p>
            <span className={c.is_active ? 'shrink-0 text-[10px] font-medium text-green-400' : 'shrink-0 text-[10px] font-medium text-gray-500'}>{c.is_active ? 'Active' : 'Locked'}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            <span>{c.members} member{c.members === 1 ? '' : 's'}</span>
            <span>Funds <span className="text-gray-300">{peso(c.balance)}</span></span>
            <span>Profit <span className="text-green-400">{peso(c.profit)}</span></span>
            <span>Return <span className="text-gray-300">{c.expected_return_pct}%</span></span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Fund cap</span>
          <span className="text-gray-400">{c.cap > 0 ? `${peso(c.raised)} / ${peso(c.cap)} (${c.capPct.toFixed(0)}%)` : `${peso(c.raised)} raised · Unlimited`}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0f0f0f]">
          <div className={`h-full rounded-full ${c.cap > 0 ? barColor : 'bg-gray-700'}`} style={{ width: `${c.cap > 0 ? c.capPct : 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function TopMemberRow({ t, rank }: { t: TopMember; rank: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#141414] p-3.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/15 text-[11px] font-semibold text-violet-300">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-200">{t.name}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#0f0f0f]">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${t.share}%` }} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-100">{peso(t.invested)}</p>
        <p className="text-[11px] text-gray-500">{t.share.toFixed(1)}% · {peso(t.profit)} profit</p>
      </div>
    </div>
  )
}

const activityMeta: Record<Activity['kind'], { label: string; icon: React.ReactNode; color: string; sign: string }> = {
  deposit:    { label: 'Funded wallet',  icon: <ArrowDownToLine size={13} />, color: 'text-green-400 bg-green-500/10', sign: '+' },
  withdrawal: { label: 'Withdrew',        icon: <ArrowUpFromLine size={13} />, color: 'text-red-400 bg-red-500/10', sign: '-' },
  profit:     { label: 'Earned profit',   icon: <TrendingUp size={13} />,      color: 'text-green-400 bg-green-500/10', sign: '+' },
  invest:     { label: 'Invested',        icon: <Landmark size={13} />,        color: 'text-violet-300 bg-violet-500/10', sign: '' },
  pullout:    { label: 'Pulled out',      icon: <ArrowUpFromLine size={13} />, color: 'text-amber-400 bg-amber-500/10', sign: '' },
}

function ActivityRow({ a }: { a: Activity }) {
  const meta = activityMeta[a.kind]
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#141414] px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.color}`}>{meta.icon}</span>
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-200">{a.name}</p>
          <p className="truncate text-[11px] text-gray-600">{meta.label} · {fmtDateTime(a.when)}</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-medium text-gray-200">{meta.sign}{peso(a.amount)}</p>
    </div>
  )
}
