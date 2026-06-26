import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { CheckCircle, XCircle, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'

type JoinReq = {
  id: string; member_id: string; center_id: string; amount: number; created_at: string
  member: { full_name: string; email: string } | null
  center: { name: string } | null
}
type WdReq = {
  id: string; investment_id: string; member_id: string; amount: number; created_at: string
  member: { full_name: string; email: string } | null
}
type InvRow = {
  investment_id: string; member_id: string; center_id: string
  balance: number; total_deposits: number; total_profit: number; total_withdrawn: number
}

const fmt = (n: number) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

export default function AdminInvestments() {
  const qc = useQueryClient()
  const [profitInputs, setProfitInputs] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  const { data: joinReqs } = useQuery({
    queryKey: ['inv-join-reqs'],
    queryFn: async (): Promise<JoinReq[]> => {
      const { data, error } = await supabase
        .from('investment_join_requests')
        .select('id, member_id, center_id, amount, created_at, member:profiles!member_id(full_name, email), center:investment_centers(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as JoinReq[]
    },
  })

  const { data: wdReqs } = useQuery({
    queryKey: ['inv-wd-reqs'],
    queryFn: async (): Promise<WdReq[]> => {
      const { data, error } = await supabase
        .from('investment_withdrawal_requests')
        .select('id, investment_id, member_id, amount, created_at, member:profiles!member_id(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as WdReq[]
    },
  })

  const { data: investments } = useQuery({
    queryKey: ['inv-all'],
    queryFn: async (): Promise<(InvRow & { member: { full_name: string } | null; center: { name: string } | null })[]> => {
      const { data: balances, error } = await supabase
        .from('investment_balances')
        .select('*')
      if (error) throw error
      const rows = (balances ?? []) as InvRow[]
      if (rows.length === 0) return []
      // fetch member + center names
      const memberIds = [...new Set(rows.map((r) => r.member_id))]
      const centerIds = [...new Set(rows.map((r) => r.center_id))]
      const [{ data: members }, { data: centers }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', memberIds),
        supabase.from('investment_centers').select('id, name').in('id', centerIds),
      ])
      const mMap = new Map((members ?? []).map((m) => [m.id, m.full_name]))
      const cMap = new Map((centers ?? []).map((c) => [c.id, c.name]))
      return rows.map((r) => ({
        ...r,
        member: { full_name: mMap.get(r.member_id) ?? 'Member' },
        center: { name: cMap.get(r.center_id) ?? 'Center' },
      }))
    },
  })

  const approveJoin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_investment_join', { p_request_id: id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inv-join-reqs'] }); qc.invalidateQueries({ queryKey: ['inv-all'] }) },
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Failed to approve'),
  })

  const rejectJoin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_join_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-join-reqs'] }),
  })

  const approveWd = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_investment_withdrawal', { p_request_id: id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inv-wd-reqs'] }); qc.invalidateQueries({ queryKey: ['inv-all'] }) },
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Failed to approve'),
  })

  const rejectWd = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_withdrawal_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-wd-reqs'] }),
  })

  const addProfit = useMutation({
    mutationFn: async ({ investmentId, amount }: { investmentId: string; amount: number }) => {
      const { error } = await supabase.rpc('add_investment_profit', { p_investment_id: investmentId, p_amount: amount, p_note: '' })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['inv-all'] })
      setProfitInputs((p) => ({ ...p, [vars.investmentId]: '' }))
      setFeedback({ id: vars.investmentId, msg: 'Profit added', ok: true })
      setTimeout(() => setFeedback(null), 2500)
    },
    onError: (e: unknown, vars) => setFeedback({ id: vars.investmentId, msg: e instanceof Error ? e.message : 'Failed', ok: false }),
  })

  function submitProfit(investmentId: string) {
    const amount = Number(profitInputs[investmentId])
    if (!profitInputs[investmentId] || isNaN(amount) || amount <= 0) {
      setFeedback({ id: investmentId, msg: 'Enter a valid amount', ok: false })
      return
    }
    addProfit.mutate({ investmentId, amount })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Investments</h1>

      {/* Join requests */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300"><ArrowDownToLine size={15} /> Join Requests</h2>
        {(joinReqs?.length ?? 0) === 0 && <p className="text-sm text-gray-600">No pending join requests.</p>}
        {joinReqs?.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-200">{r.member?.full_name}</p>
              <p className="truncate text-xs text-gray-500">wants to join <span className="text-violet-300">{r.center?.name}</span> with <span className="text-gray-300">{fmt(r.amount)}</span></p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => approveJoin.mutate(r.id)} disabled={approveJoin.isPending} className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition disabled:opacity-50"><CheckCircle size={12} /> Approve</button>
              <button onClick={() => rejectJoin.mutate(r.id)} className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"><XCircle size={12} /> Reject</button>
            </div>
          </div>
        ))}
      </section>

      {/* Pull-out requests */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300"><ArrowUpFromLine size={15} /> Pull-out Requests</h2>
        {(wdReqs?.length ?? 0) === 0 && <p className="text-sm text-gray-600">No pending pull-out requests.</p>}
        {wdReqs?.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-200">{r.member?.full_name}</p>
              <p className="truncate text-xs text-gray-500">wants to pull out <span className="text-gray-300">{fmt(r.amount)}</span> to wallet</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => approveWd.mutate(r.id)} disabled={approveWd.isPending} className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition disabled:opacity-50"><CheckCircle size={12} /> Approve</button>
              <button onClick={() => rejectWd.mutate(r.id)} className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"><XCircle size={12} /> Reject</button>
            </div>
          </div>
        ))}
      </section>

      {/* Active investments — add profit */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300"><TrendingUp size={15} /> Active Investments — Add Profit</h2>
        {(investments?.length ?? 0) === 0 && <p className="text-sm text-gray-600">No active investments yet.</p>}
        {investments?.map((inv) => (
          <div key={inv.investment_id} className="rounded-xl border border-gray-800 bg-[#141414] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-200">{inv.member?.full_name} · <span className="text-violet-300">{inv.center?.name}</span></p>
                <p className="truncate text-xs text-gray-500">Balance {fmt(inv.balance)} · Profit <span className="text-green-400">{fmt(inv.total_profit)}</span> · Deposits {fmt(inv.total_deposits)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-44">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₱</span>
                <input type="number" min="0" step="0.01" value={profitInputs[inv.investment_id] ?? ''} onChange={(e) => setProfitInputs((p) => ({ ...p, [inv.investment_id]: e.target.value }))} placeholder="Profit amount" className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] py-2 pl-7 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
              </div>
              <button onClick={() => submitProfit(inv.investment_id)} disabled={addProfit.isPending} className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"><TrendingUp size={15} /> Add Profit</button>
            </div>
            {feedback?.id === inv.investment_id && <p className={feedback.ok ? 'mt-2 text-xs text-green-400' : 'mt-2 text-xs text-red-400'}>{feedback.msg}</p>}
          </div>
        ))}
      </section>
    </div>
  )
}
