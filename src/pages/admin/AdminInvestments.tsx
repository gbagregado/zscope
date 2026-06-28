import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  CheckCircle, XCircle, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Building2, ChevronRight, ArrowLeft, Users, Wallet, PiggyBank,
  CheckSquare, Square, Sparkles, Search, X, AlertTriangle, RotateCcw,
  UserMinus, SlidersHorizontal,
} from 'lucide-react'
import { useConfirm } from '../../components/ConfirmDialog'

type Center = { id: string; name: string; image_url: string | null; fund_cap: number; max_per_member: number }
type Balance = {
  investment_id: string; member_id: string; center_id: string; created_at: string
  balance: number; total_deposits: number; total_profit: number; total_withdrawn: number
}
type JoinReq = {
  id: string; member_id: string; center_id: string; amount: number; created_at: string
  member: { full_name: string; email: string } | null
}
type WdReq = {
  id: string; investment_id: string; member_id: string; amount: number; created_at: string
  member: { full_name: string; email: string } | null
  investment: { center_id: string } | null
}

const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })

export default function AdminInvestments() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null)
  const [profitInputs, setProfitInputs] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null)
  // bulk profit distribution
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [distType, setDistType] = useState<'total' | 'percent'>('total')
  const [distMode, setDistMode] = useState<'proportional' | 'equal'>('proportional')
  const [distBase, setDistBase] = useState<'deposits' | 'balance'>('deposits')
  const [distAmount, setDistAmount] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  // per-member cap editing
  const [capEditing, setCapEditing] = useState<string | null>(null) // member_id
  const [capInput, setCapInput] = useState('')
  // member removal (kick-out) flow
  const [removeTarget, setRemoveTarget] = useState<Balance | null>(null)
  const [removeMode, setRemoveMode] = useState<'all' | 'capital'>('all')
  const [removeReason, setRemoveReason] = useState('')
  const [removeError, setRemoveError] = useState<string | null>(null)

  useEffect(() => { setSelected(new Set()); setDistAmount(''); setMemberSearch('') }, [selectedCenterId])

  const { data: centers } = useQuery({    queryKey: ['inv-centers-min'],
    queryFn: async (): Promise<Center[]> => {
      const { data, error } = await supabase
        .from('investment_centers')
        .select('id, name, image_url, fund_cap, max_per_member')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Center[]
    },
  })

  const { data: balances } = useQuery({
    queryKey: ['inv-balances'],
    queryFn: async (): Promise<Balance[]> => {
      const { data, error } = await supabase
        .from('investment_balances')
        .select('investment_id, member_id, center_id, created_at, balance, total_deposits, total_profit, total_withdrawn')
      if (error) throw error
      return (data ?? []) as Balance[]
    },
  })

  const { data: profilesMap } = useQuery({
    queryKey: ['inv-profiles', (balances ?? []).map((b) => b.member_id).join(',')],
    enabled: !!balances,
    queryFn: async (): Promise<Map<string, string>> => {
      const ids = [...new Set((balances ?? []).map((b) => b.member_id))]
      if (ids.length === 0) return new Map()
      const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      if (error) throw error
      return new Map((data ?? []).map((m) => [m.id, m.full_name]))
    },
  })

  const { data: joinReqs } = useQuery({
    queryKey: ['inv-join-reqs'],
    queryFn: async (): Promise<JoinReq[]> => {
      const { data, error } = await supabase
        .from('investment_join_requests')
        .select('id, member_id, center_id, amount, created_at, member:profiles!member_id(full_name, email)')
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
        .select('id, investment_id, member_id, amount, created_at, member:profiles!member_id(full_name, email), investment:investments(center_id)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as WdReq[]
    },
  })

  // ---- aggregations per center ----
  const centerInvestmentIds = useMemo(
    () => (balances ?? []).filter((b) => b.center_id === selectedCenterId).map((b) => b.investment_id),
    [balances, selectedCenterId],
  )

  const { data: recentInvProfits } = useQuery({
    queryKey: ['inv-recent-profits', selectedCenterId, centerInvestmentIds.join(',')],
    enabled: !!selectedCenterId && centerInvestmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_transactions')
        .select('id, investment_id, type, amount, description, created_at')
        .in('investment_id', centerInvestmentIds)
        .in('type', ['profit', 'reversal'])
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: memberCaps } = useQuery({
    queryKey: ['inv-member-caps', selectedCenterId],
    enabled: !!selectedCenterId,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('investment_member_caps')
        .select('member_id, max_amount')
        .eq('center_id', selectedCenterId!)
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.member_id, Number(r.max_amount)]))
    },
  })

  const { data: removals } = useQuery({
    queryKey: ['inv-removals', selectedCenterId],
    enabled: !!selectedCenterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_removals')
        .select('id, member_id, mode, returned_amount, forfeited_amount, reason, reverted_at, created_at')
        .eq('center_id', selectedCenterId!)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })

  const summaries = useMemo(() => {
    const map = new Map<string, {
      members: number; totalFunds: number; totalProfit: number
      totalDeposits: number; totalWithdrawn: number; pending: number
    }>()
    for (const c of centers ?? []) {
      map.set(c.id, { members: 0, totalFunds: 0, totalProfit: 0, totalDeposits: 0, totalWithdrawn: 0, pending: 0 })
    }
    for (const b of balances ?? []) {
      const s = map.get(b.center_id)
      if (!s) continue
      s.members += 1
      s.totalFunds += Number(b.balance)
      s.totalProfit += Number(b.total_profit)
      s.totalDeposits += Number(b.total_deposits)
      s.totalWithdrawn += Number(b.total_withdrawn)
    }
    for (const r of joinReqs ?? []) {
      const s = map.get(r.center_id)
      if (s) s.pending += 1
    }
    for (const r of wdReqs ?? []) {
      const cid = r.investment?.center_id
      if (cid && map.has(cid)) map.get(cid)!.pending += 1
    }
    return map
  }, [centers, balances, joinReqs, wdReqs])

  const selectedCenter = centers?.find((c) => c.id === selectedCenterId) ?? null
  const centerMembers = useMemo(
    () => (balances ?? []).filter((b) => b.center_id === selectedCenterId)
      .sort((a, b) => Number(b.balance) - Number(a.balance)),
    [balances, selectedCenterId],
  )
  const centerJoinReqs = (joinReqs ?? []).filter((r) => r.center_id === selectedCenterId)
  const centerWdReqs = (wdReqs ?? []).filter((r) => r.investment?.center_id === selectedCenterId)
  const selSummary = selectedCenterId ? summaries.get(selectedCenterId) : undefined

  // ---- mutations ----
  const approveJoin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_investment_join', { p_request_id: id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inv-join-reqs'] }); qc.invalidateQueries({ queryKey: ['inv-balances'] }) },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inv-wd-reqs'] }); qc.invalidateQueries({ queryKey: ['inv-balances'] }) },
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
      qc.invalidateQueries({ queryKey: ['inv-balances'] })
      qc.invalidateQueries({ queryKey: ['inv-recent-profits'] })
      setProfitInputs((p) => ({ ...p, [vars.investmentId]: '' }))
      setFeedback({ id: vars.investmentId, msg: 'Profit added', ok: true })
      setTimeout(() => setFeedback(null), 2500)
    },
    onError: (e: unknown, vars) => setFeedback({ id: vars.investmentId, msg: e instanceof Error ? e.message : 'Failed', ok: false }),
  })

  async function submitProfit(investmentId: string) {
    const amount = Number(profitInputs[investmentId])
    if (!profitInputs[investmentId] || isNaN(amount) || amount <= 0) {
      setFeedback({ id: investmentId, msg: 'Enter a valid amount', ok: false })
      return
    }
    const m = centerMembers.find((x) => x.investment_id === investmentId)
    const ok = await confirm({
      title: 'Add profit',
      message: `Credit ${fmt(amount)} profit to ${m ? nameOf(m.member_id) : 'this member'}?`,
      confirmText: 'Add profit',
    })
    if (!ok) return
    addProfit.mutate({ investmentId, amount })
  }

  const distribute = useMutation({
    mutationFn: async (entries: { investmentId: string; amount: number }[]) => {
      for (const e of entries) {
        const { error } = await supabase.rpc('add_investment_profit', { p_investment_id: e.investmentId, p_amount: e.amount, p_note: 'Profit distribution' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-balances'] })
      qc.invalidateQueries({ queryKey: ['inv-recent-profits'] })
      setSelected(new Set()); setDistAmount('')
      setFeedback({ id: 'distribute', msg: 'Profit distributed to members', ok: true })
      setTimeout(() => setFeedback(null), 2500)
    },
    onError: (e: unknown) => setFeedback({ id: 'distribute', msg: e instanceof Error ? e.message : 'Failed to distribute', ok: false }),
  })

  const reverseInvTx = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('reverse_investment_transaction', { p_tx_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-balances'] })
      qc.invalidateQueries({ queryKey: ['inv-recent-profits'] })
    },
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Failed to undo'),
  })

  const setMemberCap = useMutation({
    mutationFn: async ({ memberId, max }: { memberId: string; max: number | null }) => {
      const { error } = await supabase.rpc('set_member_cap', {
        p_center_id: selectedCenterId!, p_member_id: memberId, p_max: max,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-member-caps', selectedCenterId] })
      setCapEditing(null); setCapInput('')
    },
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Failed to save limit'),
  })

  const removeMember = useMutation({
    mutationFn: async ({ investmentId, mode, reason }: { investmentId: string; mode: 'all' | 'capital'; reason: string }) => {
      const { error } = await supabase.rpc('remove_member_from_investment', {
        p_investment_id: investmentId, p_mode: mode, p_reason: reason,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-balances'] })
      qc.invalidateQueries({ queryKey: ['inv-removals', selectedCenterId] })
      setRemoveTarget(null); setRemoveReason(''); setRemoveError(null)
    },
    onError: (e: unknown) => setRemoveError(e instanceof Error ? e.message : 'Failed to remove member'),
  })

  const undoRemoval = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('undo_member_removal', { p_removal_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-balances'] })
      qc.invalidateQueries({ queryKey: ['inv-removals', selectedCenterId] })
    },
    onError: (e: unknown) => alert(e instanceof Error ? e.message : 'Failed to undo removal'),
  })

  // confirm-gated request actions
  async function doApproveJoin(r: JoinReq) {
    const ok = await confirm({ title: 'Approve join request', message: `Approve ${r.member?.full_name ?? 'this member'} joining with ${fmt(r.amount)}? This debits their wallet and adds the deposit to this center.`, confirmText: 'Approve' })
    if (ok) approveJoin.mutate(r.id)
  }
  async function doRejectJoin(r: JoinReq) {
    const ok = await confirm({ title: 'Reject join request', message: `Reject ${r.member?.full_name ?? 'this member'}'s request to join with ${fmt(r.amount)}?`, confirmText: 'Reject', tone: 'danger' })
    if (ok) rejectJoin.mutate(r.id)
  }
  async function doApproveWd(r: WdReq) {
    const ok = await confirm({ title: 'Approve pull-out', message: `Approve ${r.member?.full_name ?? 'this member'} pulling out ${fmt(r.amount)} to their wallet?`, confirmText: 'Approve' })
    if (ok) approveWd.mutate(r.id)
  }
  async function doRejectWd(r: WdReq) {
    const ok = await confirm({ title: 'Reject pull-out', message: `Reject ${r.member?.full_name ?? 'this member'}'s pull-out of ${fmt(r.amount)}?`, confirmText: 'Reject', tone: 'danger' })
    if (ok) rejectWd.mutate(r.id)
  }
  async function undoInvProfit(id: string, investmentId: string, amount: number) {
    const m = centerMembers.find((x) => x.investment_id === investmentId)
    const ok = await confirm({ title: 'Undo profit', message: `Reverse ${fmt(amount)} profit for ${m ? nameOf(m.member_id) : 'this member'}? It is deducted from their investment and a reversal record is kept.`, confirmText: 'Undo profit', tone: 'danger' })
    if (ok) reverseInvTx.mutate(id)
  }

  const nameOf = (id: string) => profilesMap?.get(id) ?? 'Member'

  const displayMembers = memberSearch.trim()
    ? centerMembers.filter((m) => nameOf(m.member_id).toLowerCase().includes(memberSearch.trim().toLowerCase()))
    : centerMembers

  // ---- per-member cap helpers ----
  function openCapEditor(m: Balance) {
    const existing = memberCaps?.get(m.member_id)
    setCapInput(existing != null ? String(existing) : '')
    setCapEditing(m.member_id)
  }
  function saveCap(memberId: string) {
    const raw = capInput.trim()
    if (raw === '') { setMemberCap.mutate({ memberId, max: null }); return } // clear → center default
    const max = Number(raw)
    if (isNaN(max) || max < 0) { alert('Enter a valid amount (0 = unlimited)'); return }
    setMemberCap.mutate({ memberId, max })
  }

  // ---- removal (kick-out) helpers ----
  function openRemove(m: Balance) {
    setRemoveTarget(m)
    setRemoveMode('all')
    setRemoveReason('')
    setRemoveError(null)
  }
  const removeCalc = useMemo(() => {
    if (!removeTarget) return { balance: 0, capital: 0, returned: 0, forfeited: 0 }
    const balance = Math.max(0, Number(removeTarget.balance))
    const capital = Math.max(0, Number(removeTarget.total_deposits) - Number(removeTarget.total_withdrawn))
    const returned = removeMode === 'all' ? balance : Math.min(capital, balance)
    const forfeited = balance - returned
    return { balance, capital, returned, forfeited }
  }, [removeTarget, removeMode])
  function confirmRemove() {
    if (!removeTarget) return
    if (removeReason.trim() === '') { setRemoveError('Please enter a reason.'); return }
    setRemoveError(null)
    removeMember.mutate({ investmentId: removeTarget.investment_id, mode: removeMode, reason: removeReason.trim() })
  }
  async function doUndoRemoval(r: { id: string; member_id: string; returned_amount: number }) {
    const ok = await confirm({
      title: 'Undo removal',
      message: `Reopen ${nameOf(r.member_id)}'s investment and pull back the ${fmt(r.returned_amount)} that was returned to their wallet?\n\nThis only works if those funds are still in their wallet.`,
      confirmText: 'Undo removal',
      tone: 'danger',
    })
    if (ok) undoRemoval.mutate(r.id)
  }

  // ---- bulk distribution helpers ----
  function toggleMember(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelected((prev) => {
      const allShown = displayMembers.every((m) => prev.has(m.investment_id))
      const n = new Set(prev)
      if (allShown) { for (const m of displayMembers) n.delete(m.investment_id) }
      else { for (const m of displayMembers) n.add(m.investment_id) }
      return n
    })
  }
  const baseOf = (m: Balance) => (distBase === 'balance' ? Number(m.balance) : Number(m.total_deposits))
  const selectedMembers = centerMembers.filter((m) => selected.has(m.investment_id))
  const totalBase = selectedMembers.reduce((s, m) => s + baseOf(m), 0)
  const distTotal = Number(distAmount) || 0
  const shares: Record<string, number> = {}
  if (selectedMembers.length > 0 && distTotal > 0) {
    if (distType === 'percent') {
      // Each member gets a % of their own base (invested or balance).
      for (const m of selectedMembers) {
        const amt = Math.round(baseOf(m) * distTotal) / 100 // base * pct / 100, to cents
        if (amt > 0) shares[m.investment_id] = amt
      }
    } else {
      const raw = selectedMembers.map((m) => {
        const amt = distMode === 'equal'
          ? distTotal / selectedMembers.length
          : totalBase > 0 ? distTotal * (baseOf(m) / totalBase) : 0
        return { id: m.investment_id, amt: Math.round(amt * 100) / 100 }
      })
      const sum = raw.reduce((s, r) => s + r.amt, 0)
      const diff = Math.round((distTotal - sum) * 100) / 100
      if (diff !== 0) {
        let mi = 0
        for (let i = 1; i < raw.length; i++) if (raw[i].amt > raw[mi].amt) mi = i
        raw[mi].amt = Math.round((raw[mi].amt + diff) * 100) / 100
      }
      for (const r of raw) shares[r.id] = r.amt
    }
  }
  const sharesTotal = Object.values(shares).reduce((s, v) => s + v, 0)
  async function submitDistribute() {
    const entries = Object.entries(shares).filter(([, amt]) => amt > 0).map(([investmentId, amount]) => ({ investmentId, amount }))
    if (entries.length === 0) { setFeedback({ id: 'distribute', msg: 'Select members and enter an amount', ok: false }); return }
    const total = entries.reduce((s, e) => s + e.amount, 0)
    const ok = await confirm({
      title: 'Distribute profit',
      message: distType === 'percent'
        ? `Give ${distTotal}% of each member's ${distBase === 'balance' ? 'balance' : 'invested capital'} to ${entries.length} member${entries.length === 1 ? '' : 's'}. Total ${fmt(total)}.`
        : `Distribute ${fmt(total)} across ${entries.length} member${entries.length === 1 ? '' : 's'}.`,
      confirmText: 'Distribute',
    })
    if (!ok) return
    distribute.mutate(entries)
  }
  const sharePct = (m: Balance) => distMode === 'equal'
    ? (selectedMembers.length ? 100 / selectedMembers.length : 0)
    : (totalBase > 0 ? (baseOf(m) / totalBase) * 100 : 0)

  // =================== CENTER LIST ===================
  if (!selectedCenter) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-100">Investments</h1>
        <p className="text-sm text-gray-500">Select an investment center to manage its members, requests, and profits.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(centers?.length ?? 0) === 0 && <p className="text-sm text-gray-600">No investment centers yet.</p>}
          {centers?.map((c) => {
            const s = summaries.get(c.id)
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCenterId(c.id)}
                className="group flex items-center gap-3 rounded-xl border border-gray-800 bg-[#141414] p-4 text-left transition hover:border-violet-500/50"
              >
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Building2 size={22} /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-100">{c.name}</p>
                    {!!s?.pending && (
                      <span className="shrink-0 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">{s.pending} pending</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><Users size={11} />{s?.members ?? 0}</span>
                    <span>Funds <span className="text-gray-300">{fmt(s?.totalFunds ?? 0)}</span></span>
                    <span>Profit <span className="text-green-400">{fmt(s?.totalProfit ?? 0)}</span></span>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-gray-600 group-hover:text-violet-400" />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // =================== CENTER DETAIL ===================
  return (
    <div className="space-y-5">
      <button onClick={() => setSelectedCenterId(null)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition">
        <ArrowLeft size={16} /> All Centers
      </button>

      {/* Header */}
      <div className="rounded-xl border border-gray-800 bg-[#141414] p-4">
        <div className="flex items-center gap-3">
          {selectedCenter.image_url
            ? <img src={selectedCenter.image_url} alt={selectedCenter.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
            : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Building2 size={22} /></div>}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-100">{selectedCenter.name}</h1>
            <p className="text-xs text-gray-500">{selSummary?.members ?? 0} member{(selSummary?.members ?? 0) === 1 ? '' : 's'} invested</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat icon={<Wallet size={15} />} label="Total Funds" value={fmt(selSummary?.totalFunds ?? 0)} />
          <Stat icon={<TrendingUp size={15} />} label="Total Profit" value={fmt(selSummary?.totalProfit ?? 0)} accent="green" />
          <Stat icon={<PiggyBank size={15} />} label="Total Deposits" value={fmt(selSummary?.totalDeposits ?? 0)} />
          <Stat icon={<ArrowUpFromLine size={15} />} label="Pulled Out" value={fmt(selSummary?.totalWithdrawn ?? 0)} />
        </div>

        {/* Fund cap progress */}
        {(() => {
          const cap = Number(selectedCenter.fund_cap) || 0
          const raised = (selSummary?.totalDeposits ?? 0) - (selSummary?.totalWithdrawn ?? 0)
          if (cap <= 0) return (
            <p className="mt-3 text-[11px] text-gray-600">Fund cap: Unlimited · Raised {fmt(raised)}</p>
          )
          const pct = Math.min(100, (raised / cap) * 100)
          const full = raised >= cap
          const near = !full && pct >= 90
          const barColor = full ? 'bg-red-500' : near ? 'bg-yellow-500' : 'bg-violet-500'
          return (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Fund cap</span>
                <span className={full ? 'font-medium text-red-400' : near ? 'font-medium text-yellow-400' : 'text-gray-400'}>
                  {fmt(raised)} / {fmt(cap)} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#0f0f0f]">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              {full
                ? <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400"><AlertTriangle size={12} /> Fund cap reached. New join requests will be blocked until the cap is raised or members pull out.</p>
                : <p className="mt-1.5 text-[11px] text-gray-600">Remaining capacity: {fmt(cap - raised)}</p>}
            </div>
          )
        })()}
      </div>

      {/* Pending join requests */}
      {centerJoinReqs.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300"><ArrowDownToLine size={15} /> Join Requests</h2>
          {centerJoinReqs.map((r) => {
            const cap = Number(selectedCenter.fund_cap) || 0
            const raised = (selSummary?.totalDeposits ?? 0) - (selSummary?.totalWithdrawn ?? 0)
            const exceeds = cap > 0 && raised + Number(r.amount) > cap
            const memberCap = Number(selectedCenter.max_per_member) || 0
            const memberBal = centerMembers.find((m) => m.member_id === r.member_id)
            const memberHeld = memberBal ? Number(memberBal.total_deposits) - Number(memberBal.total_withdrawn) : 0
            const exceedsMember = memberCap > 0 && memberHeld + Number(r.amount) > memberCap
            const blocked = exceeds || exceedsMember
            return (
            <div key={r.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-200">{r.member?.full_name}</p>
                  <p className="truncate text-xs text-gray-500">wants to join with <span className="text-gray-300">{fmt(r.amount)}</span></p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => doApproveJoin(r)} disabled={approveJoin.isPending || blocked} title={exceeds ? 'Exceeds fund cap' : exceedsMember ? 'Exceeds per-member limit' : undefined} className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"><CheckCircle size={12} /> Approve</button>
                  <button onClick={() => doRejectJoin(r)} className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"><XCircle size={12} /> Reject</button>
                </div>
              </div>
              {exceeds && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-red-400"><AlertTriangle size={12} /> Approving would exceed the fund cap by {fmt(raised + Number(r.amount) - cap)}. Raise the cap or wait for pull-outs.</p>
              )}
              {exceedsMember && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-red-400"><AlertTriangle size={12} /> Exceeds the per-member limit of {fmt(memberCap)} (already holds {fmt(memberHeld)}). Raise the limit or reduce the amount.</p>
              )}
            </div>
            )
          })}
        </section>
      )}

      {/* Pending pull-out requests */}
      {centerWdReqs.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300"><ArrowUpFromLine size={15} /> Pull-out Requests</h2>
          {centerWdReqs.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-200">{r.member?.full_name}</p>
                <p className="truncate text-xs text-gray-500">wants to pull out <span className="text-gray-300">{fmt(r.amount)}</span> to wallet</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => doApproveWd(r)} disabled={approveWd.isPending} className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition disabled:opacity-50"><CheckCircle size={12} /> Approve</button>
                <button onClick={() => doRejectWd(r)} className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"><XCircle size={12} /> Reject</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Members */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300"><Users size={15} /> Members</h2>
        {centerMembers.length === 0 && <p className="text-sm text-gray-600">No members have joined this center yet.</p>}

        {/* Distribute profit panel */}
        {centerMembers.length > 0 && (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-200"><Sparkles size={15} /> Distribute Profit</h3>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(centerMembers.map((m) => m.investment_id)))} className="text-xs text-violet-300 hover:text-violet-200">All ({centerMembers.length})</button>
                <button onClick={toggleAll} className="text-xs text-violet-300 hover:text-violet-200">
                  {displayMembers.length > 0 && displayMembers.every((m) => selected.has(m.investment_id)) ? 'Unselect shown' : 'Select shown'}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">Tick members, then give a fixed total or a % of each member's base.</p>

            <div className="mt-3 inline-flex rounded-lg border border-gray-700 bg-[#0f0f0f] p-0.5 text-xs">
              <button onClick={() => setDistType('total')} className={`rounded-md px-3 py-1.5 transition ${distType === 'total' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Total amount</button>
              <button onClick={() => setDistType('percent')} className={`rounded-md px-3 py-1.5 transition ${distType === 'percent' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Percent each</button>
            </div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative sm:w-44">
                {distType === 'total'
                  ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                  : <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>}
                <input type="number" min="0" step={distType === 'percent' ? '0.1' : '0.01'} value={distAmount} onChange={(e) => setDistAmount(e.target.value)} placeholder={distType === 'percent' ? 'Percent each' : 'Total profit'} className={`w-full rounded-lg border border-gray-700 bg-[#0f0f0f] py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none ${distType === 'total' ? 'pl-7 pr-3' : 'pl-3 pr-7'}`} />
              </div>
              {distType === 'total' && (
                <div className="inline-flex rounded-lg border border-gray-700 bg-[#0f0f0f] p-0.5 text-xs">
                  <button onClick={() => setDistMode('proportional')} className={`rounded-md px-3 py-1.5 transition ${distMode === 'proportional' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Proportional</button>
                  <button onClick={() => setDistMode('equal')} className={`rounded-md px-3 py-1.5 transition ${distMode === 'equal' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Equal</button>
                </div>
              )}
              {(distType === 'percent' || distMode === 'proportional') && (
                <div className="inline-flex rounded-lg border border-gray-700 bg-[#0f0f0f] p-0.5 text-xs">
                  <button onClick={() => setDistBase('deposits')} className={`rounded-md px-3 py-1.5 transition ${distBase === 'deposits' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>By Invested</button>
                  <button onClick={() => setDistBase('balance')} className={`rounded-md px-3 py-1.5 transition ${distBase === 'balance' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>By Balance</button>
                </div>
              )}
            </div>

            {selected.size > 0 && (
              <div className="mt-3 rounded-lg border border-violet-500/20 bg-[#0f0f0f] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-violet-300">Selected ({selected.size})</span>
                  <button onClick={() => setSelected(new Set())} className="text-[11px] text-gray-400 hover:text-gray-200">Clear all</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...selected].map((id) => {
                    const mm = centerMembers.find((x) => x.investment_id === id)
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-violet-600/20 py-1 pl-2.5 pr-1 text-xs text-violet-200">
                        {mm ? nameOf(mm.member_id) : 'Member'}
                        <button onClick={() => toggleMember(id)} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-violet-500/40" aria-label="Remove"><X size={11} /></button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {selected.size > 0 && distTotal > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-gray-800 bg-[#0f0f0f] p-3">
                {selectedMembers.map((m) => (
                  <div key={m.investment_id} className="flex items-center justify-between text-xs">
                    <span className="truncate text-gray-400">{nameOf(m.member_id)} <span className="text-gray-600">({distType === 'percent' ? `${distTotal}% of ${fmt(baseOf(m))}` : `${sharePct(m).toFixed(1)}%`})</span></span>
                    <span className="shrink-0 font-medium text-green-400">+{fmt(shares[m.investment_id] ?? 0)}</span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t border-gray-800 pt-1 text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="shrink-0 font-semibold text-green-400">+{fmt(sharesTotal)}</span>
                </div>
              </div>
            )}

            <button onClick={submitDistribute} disabled={distribute.isPending || selected.size === 0 || distTotal <= 0} className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
              <TrendingUp size={15} /> Distribute to {selected.size} member{selected.size === 1 ? '' : 's'}
            </button>
            {feedback?.id === 'distribute' && <p className={feedback.ok ? 'mt-2 text-xs text-green-400' : 'mt-2 text-xs text-red-400'}>{feedback.msg}</p>}
          </div>
        )}

        {/* Recent profit entries — undo a mistake */}
        {(recentInvProfits?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-gray-800 bg-[#141414] p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-400">Recent Profit Entries</h3>
            <div className="space-y-2">
              {recentInvProfits!.map((p) => {
                const isReversal = p.type === 'reversal'
                const mm = centerMembers.find((x) => x.investment_id === p.investment_id)
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-300">{mm ? nameOf(mm.member_id) : 'Member'}</p>
                      <p className="truncate text-xs text-gray-600">{p.description} · {fmtDate(p.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className={isReversal ? 'text-sm font-medium text-red-400' : 'text-sm font-medium text-green-400'}>{isReversal ? '−' : '+'}{fmt(Number(p.amount))}</p>
                      {!isReversal && (
                        <button onClick={() => undoInvProfit(p.id, p.investment_id, Number(p.amount))} disabled={reverseInvTx.isPending} title="Undo this profit" className="flex items-center gap-1 rounded-lg border border-gray-700 px-2 py-1 text-[11px] text-gray-400 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50 transition">
                          <RotateCcw size={12} /> Undo
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Member search */}
        {centerMembers.length > 0 && (
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search members in this center" className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
          </div>
        )}
        {centerMembers.length > 0 && displayMembers.length === 0 && <p className="text-sm text-gray-600">No members match your search.</p>}

        {displayMembers.map((m) => (
          <div key={m.investment_id} className={`rounded-xl border bg-[#141414] p-4 transition ${selected.has(m.investment_id) ? 'border-violet-500/50' : 'border-gray-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => toggleMember(m.investment_id)} className="flex min-w-0 items-center gap-2 text-left">
                {selected.has(m.investment_id)
                  ? <CheckSquare size={16} className="shrink-0 text-violet-400" />
                  : <Square size={16} className="shrink-0 text-gray-600" />}
                <span className="truncate text-sm font-semibold text-gray-100">{nameOf(m.member_id)}</span>
              </button>
              <span className="shrink-0 text-[11px] text-gray-600">Joined {fmtDate(m.created_at)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge label="Invested" value={fmt(m.total_deposits)} />
              <Badge label="Balance" value={fmt(m.balance)} accent="violet" />
              <Badge label="Profit" value={fmt(m.total_profit)} accent="green" />
              <Badge label="Pulled Out" value={fmt(m.total_withdrawn)} />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-44">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <input type="number" min="0" step="0.01" value={profitInputs[m.investment_id] ?? ''} onChange={(e) => setProfitInputs((p) => ({ ...p, [m.investment_id]: e.target.value }))} placeholder="Profit amount" className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] py-2 pl-7 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
              </div>
              <button onClick={() => submitProfit(m.investment_id)} disabled={addProfit.isPending} className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"><TrendingUp size={15} /> Add Profit</button>
            </div>

            {/* Per-member limit + remove */}
            <div className="mt-3 border-t border-gray-800 pt-3">
              {capEditing === m.member_id ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative sm:w-44">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                    <input type="number" min="0" step="0.01" value={capInput} onChange={(e) => setCapInput(e.target.value)} placeholder="0 = unlimited" autoFocus className="w-full rounded-lg border border-violet-500/40 bg-[#0f0f0f] py-2 pl-7 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveCap(m.member_id)} disabled={setMemberCap.isPending} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition">Save</button>
                    <button onClick={() => { setCapEditing(null); setCapInput('') }} className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition">Cancel</button>
                  </div>
                  <p className="text-[11px] text-gray-600 sm:ml-1">Leave blank to use the center default ({Number(selectedCenter.max_per_member) > 0 ? fmt(Number(selectedCenter.max_per_member)) : 'no limit'}).</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <SlidersHorizontal size={13} className="text-gray-500" />
                    {(() => {
                      const override = memberCaps?.get(m.member_id)
                      if (override != null) {
                        return <span className="text-gray-400">Limit: <span className="font-medium text-violet-300">{override > 0 ? fmt(override) : 'Unlimited'}</span> <span className="rounded bg-violet-600/20 px-1.5 py-0.5 text-[10px] text-violet-300">custom</span></span>
                      }
                      const def = Number(selectedCenter.max_per_member) || 0
                      return <span className="text-gray-500">Limit: {def > 0 ? fmt(def) : 'No limit'} <span className="text-gray-600">(center default)</span></span>
                    })()}
                    <button onClick={() => openCapEditor(m)} className="text-violet-400 hover:text-violet-300">Edit</button>
                  </div>
                  <button onClick={() => openRemove(m)} className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition"><UserMinus size={13} /> Remove</button>
                </div>
              )}
            </div>
            {feedback?.id === m.investment_id && <p className={feedback.ok ? 'mt-2 text-xs text-green-400' : 'mt-2 text-xs text-red-400'}>{feedback.msg}</p>}
          </div>
        ))}
      </section>

      {/* Recent removals — undo a mistake */}
      {(removals?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300"><UserMinus size={15} /> Recent Removals</h2>
          <div className="rounded-xl border border-gray-800 bg-[#141414] p-4 space-y-2">
            {removals!.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-300">
                    {nameOf(r.member_id)}
                    {r.reverted_at && <span className="ml-2 rounded bg-gray-700/50 px-1.5 py-0.5 text-[10px] text-gray-400">undone</span>}
                  </p>
                  <p className="truncate text-xs text-gray-600">
                    {r.mode === 'all' ? 'Returned all' : 'Capital only'} · {fmt(Number(r.returned_amount))} back
                    {Number(r.forfeited_amount) > 0 && <span className="text-red-400/80"> · {fmt(Number(r.forfeited_amount))} forfeited</span>}
                    {' · '}{fmtDate(r.created_at)}
                  </p>
                  <p className="truncate text-[11px] text-gray-700">“{r.reason}”</p>
                </div>
                {!r.reverted_at && (
                  <button onClick={() => doUndoRemoval(r)} disabled={undoRemoval.isPending} title="Undo this removal" className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-700 px-2 py-1 text-[11px] text-gray-400 hover:border-violet-500/40 hover:text-violet-300 disabled:opacity-50 transition">
                    <RotateCcw size={12} /> Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Removal (kick-out) modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { if (!removeMember.isPending) setRemoveTarget(null) }}>
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#141414] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-100"><UserMinus size={18} className="text-red-400" /> Remove from investment</h3>
              <button onClick={() => { if (!removeMember.isPending) setRemoveTarget(null) }} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <p className="mt-1 text-sm text-gray-400">Forced full exit for <span className="font-medium text-gray-200">{nameOf(removeTarget.member_id)}</span>. This closes their position in this center and returns funds to their wallet.</p>

            {/* mode toggle */}
            <div className="mt-4 inline-flex w-full rounded-lg border border-gray-700 bg-[#0f0f0f] p-0.5 text-xs">
              <button onClick={() => setRemoveMode('all')} className={`flex-1 rounded-md px-3 py-2 transition ${removeMode === 'all' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Return all (capital + profit)</button>
              <button onClick={() => setRemoveMode('capital')} className={`flex-1 rounded-md px-3 py-2 transition ${removeMode === 'capital' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Capital only (forfeit profit)</button>
            </div>

            {/* calculation breakdown */}
            <div className="mt-4 space-y-1.5 rounded-xl border border-gray-800 bg-[#0f0f0f] p-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Invested (capital)</span><span className="text-gray-300">{fmt(removeCalc.capital)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Profit earned</span><span className="text-green-400">{fmt(Number(removeTarget.total_profit))}</span></div>
              <div className="flex items-center justify-between border-t border-gray-800 pt-1.5"><span className="text-gray-400">Current balance</span><span className="font-medium text-gray-100">{fmt(removeCalc.balance)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-400">Returned to wallet</span><span className="font-semibold text-violet-300">{fmt(removeCalc.returned)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-400">Forfeited</span><span className={removeCalc.forfeited > 0 ? 'font-semibold text-red-400' : 'text-gray-500'}>{fmt(removeCalc.forfeited)}</span></div>
            </div>
            <p className="mt-2 text-[11px] text-gray-600">Please verify these figures before confirming. {removeMode === 'capital' ? 'Profit will be forfeited (kept by the fund).' : 'The full balance is returned.'}</p>

            {/* reason */}
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-400">Reason (required, kept for audit)</label>
              <textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} rows={2} placeholder="e.g. Member requested closure / policy violation" className="mt-1 w-full resize-none rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>

            {removeError && <p className="mt-2 flex items-center gap-1 text-xs text-red-400"><AlertTriangle size={12} /> {removeError}</p>}

            <div className="mt-4 flex gap-2">
              <button onClick={() => { if (!removeMember.isPending) setRemoveTarget(null) }} className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition">Cancel</button>
              <button onClick={confirmRemove} disabled={removeMember.isPending} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition">
                <UserMinus size={15} /> {removeMember.isPending ? 'Removing…' : `Confirm — return ${fmt(removeCalc.returned)}`}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-gray-600">You can undo this from “Recent Removals” if the funds are still in their wallet.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: 'green' }) {
  return (
    <div className="rounded-lg bg-[#0f0f0f] p-2.5">
      <div className="flex items-center gap-1.5 text-gray-500">{icon}<span className="text-[11px]">{label}</span></div>
      <p className={accent === 'green' ? 'mt-1 text-sm font-semibold text-green-400' : 'mt-1 text-sm font-semibold text-gray-100'}>{value}</p>
    </div>
  )
}

function Badge({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'violet' }) {
  const color = accent === 'green' ? 'text-green-400' : accent === 'violet' ? 'text-violet-300' : 'text-gray-200'
  return (
    <div className="rounded-lg border border-gray-800 bg-[#0f0f0f] px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xs font-semibold ${color}`}>{value}</p>
    </div>
  )
}
