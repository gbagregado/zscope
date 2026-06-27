import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Building2, TrendingUp, X } from 'lucide-react'

const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

type Center = {
  id: string; name: string; description: string | null; image_url: string | null
  expected_return_pct: number; min_investment: number; maintaining_balance: number; is_active: boolean
}
type MyInv = {
  investment_id: string; center_id: string; balance: number; total_deposits: number
  total_profit: number; total_withdrawn: number
}

export default function MemberInvestments() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [joinTarget, setJoinTarget] = useState<Center | null>(null)
  const [pullTarget, setPullTarget] = useState<{ inv: MyInv; center: Center | undefined } | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const { data: centers } = useQuery({
    queryKey: ['member-centers'],
    queryFn: async (): Promise<Center[]> => {
      const { data, error } = await supabase
        .from('investment_centers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Center[]
    },
  })

  const { data: myInvestments } = useQuery({
    queryKey: ['member-investments', profile?.id],
    enabled: !!profile?.id,
    queryFn: async (): Promise<MyInv[]> => {
      const { data, error } = await supabase
        .from('investment_balances')
        .select('investment_id, center_id, balance, total_deposits, total_profit, total_withdrawn')
        .eq('member_id', profile!.id)
      if (error) throw error
      return (data ?? []) as MyInv[]
    },
  })

  const { data: balance } = useQuery({
    queryKey: ['member-balance', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('member_balances').select('balance').eq('member_id', profile!.id).single()
      if (error) throw error
      return data
    },
  })

  const join = useMutation({
    mutationFn: async ({ center, amt }: { center: Center; amt: number }) => {
      const { error } = await supabase.from('investment_join_requests').insert({
        member_id: profile!.id, center_id: center.id, amount: amt,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member-investments'] }); closeModals(); setToast('Join request submitted — pending admin approval.') },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed to submit request'),
  })

  const pullOut = useMutation({
    mutationFn: async ({ inv, amt }: { inv: MyInv; amt: number }) => {
      const { error } = await supabase.from('investment_withdrawal_requests').insert({
        investment_id: inv.investment_id, member_id: profile!.id, amount: amt,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member-investments'] }); closeModals(); setToast('Pull-out request submitted — pending admin approval.') },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed to submit request'),
  })

  function closeModals() { setJoinTarget(null); setPullTarget(null); setAmount(''); setError('') }

  function submitJoin() {
    setError('')
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    if (joinTarget && amt < joinTarget.min_investment) { setError(`Minimum investment is ${fmt(joinTarget.min_investment)}`); return }
    if (balance && amt > balance.balance) { setError(`Amount exceeds your wallet balance (${fmt(balance.balance)})`); return }
    if (joinTarget) join.mutate({ center: joinTarget, amt })
  }

  function submitPull() {
    setError('')
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    if (pullTarget) {
      if (amt > pullTarget.inv.balance) { setError(`Amount exceeds investment balance (${fmt(pullTarget.inv.balance)})`); return }
      const maintaining = pullTarget.center?.maintaining_balance ?? 0
      if (pullTarget.inv.balance - amt < maintaining) { setError(`Must keep at least ${fmt(maintaining)} maintaining balance`); return }
      pullOut.mutate({ inv: pullTarget.inv, amt })
    }
  }

  const centerById = (id: string) => centers?.find((c) => c.id === id)
  const investedCenterIds = new Set((myInvestments ?? []).map((i) => i.center_id))
  const available = (centers ?? []).filter((c) => c.is_active)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Investments</h1>
        {balance && <span className="text-xs text-gray-500">Wallet: <span className="text-gray-300">{fmt(balance.balance)}</span></span>}
      </div>

      {toast && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300">{toast}</div>
      )}

      {/* My investments */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">My Investments</h2>
        {(myInvestments?.length ?? 0) === 0 && <p className="text-sm text-gray-600">You haven't joined any investment center yet.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {myInvestments?.map((inv) => {
            const c = centerById(inv.center_id)
            return (
              <div key={inv.investment_id} className="rounded-xl border border-gray-800 bg-[#141414] p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400"><Building2 size={18} /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-100">{c?.name ?? 'Investment'}</p>
                    {c && <p className="text-xs text-green-400">{c.expected_return_pct}% expected return</p>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[#0f0f0f] p-2.5"><p className="text-gray-500">Balance</p><p className="mt-0.5 text-sm font-semibold text-gray-100">{fmt(inv.balance)}</p></div>
                  <div className="rounded-lg bg-[#0f0f0f] p-2.5"><p className="text-gray-500">Total Profit</p><p className="mt-0.5 text-sm font-semibold text-green-400">{fmt(inv.total_profit)}</p></div>
                  <div className="rounded-lg bg-[#0f0f0f] p-2.5"><p className="text-gray-500">Deposited</p><p className="mt-0.5 text-sm text-gray-300">{fmt(inv.total_deposits)}</p></div>
                  <div className="rounded-lg bg-[#0f0f0f] p-2.5"><p className="text-gray-500">Pulled Out</p><p className="mt-0.5 text-sm text-gray-300">{fmt(inv.total_withdrawn)}</p></div>
                </div>
                {c && <p className="mt-2 text-[11px] text-gray-600">Maintaining balance: {fmt(c.maintaining_balance)}</p>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setPullTarget({ inv, center: c }); setAmount(''); setError('') }} className="flex-1 rounded-lg border border-gray-700 bg-[#0f0f0f] py-2 text-xs font-medium text-gray-200 hover:border-violet-500/60 transition">Pull Out</button>
                  {c?.is_active && <button onClick={() => { setJoinTarget(c); setAmount(''); setError('') }} className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-500 transition">Add Funds</button>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Available */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Available Centers</h2>
        {available.filter((c) => !investedCenterIds.has(c.id)).length === 0 && <p className="text-sm text-gray-600">No new centers available right now.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {available.filter((c) => !investedCenterIds.has(c.id)).map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl border border-gray-800 bg-[#141414]">
              {c.image_url
                ? <img src={c.image_url} alt={c.name} className="h-28 w-full object-cover" />
                : <div className="flex h-28 w-full items-center justify-center bg-[#0f0f0f] text-gray-700"><Building2 size={28} /></div>}
              <div className="p-4">
                <p className="text-sm font-semibold text-gray-100">{c.name}</p>
                {c.description && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{c.description}</p>}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1 text-green-400"><TrendingUp size={12} />{c.expected_return_pct}%</span>
                  <span>Min {fmt(c.min_investment)}</span>
                </div>
                <button onClick={() => { setJoinTarget(c); setAmount(''); setError('') }} className="mt-3 w-full rounded-lg bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-500 transition">Join</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Join / Add funds modal */}
      {joinTarget && (
        <Modal title={investedCenterIds.has(joinTarget.id) ? `Add funds to ${joinTarget.name}` : `Join ${joinTarget.name}`} onClose={closeModals}>
          <p className="text-xs text-gray-500">Minimum {fmt(joinTarget.min_investment)} · Wallet {balance ? fmt(balance.balance) : '—'}</p>
          <AmountInput value={amount} onChange={setAmount} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <p className="text-[11px] text-gray-600">The amount will be deducted from your wallet once an admin approves.</p>
          <button onClick={submitJoin} disabled={join.isPending} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition">{join.isPending ? 'Submitting…' : 'Submit Request'}</button>
        </Modal>
      )}

      {/* Pull out modal */}
      {pullTarget && (
        <Modal title={`Pull out from ${pullTarget.center?.name ?? 'investment'}`} onClose={closeModals}>
          <p className="text-xs text-gray-500">Balance {fmt(pullTarget.inv.balance)} · Keep at least {fmt(pullTarget.center?.maintaining_balance ?? 0)}</p>
          <AmountInput value={amount} onChange={setAmount} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <p className="text-[11px] text-gray-600">Approved funds return to your wallet. Real cash withdrawal is done from your wallet.</p>
          <button onClick={submitPull} disabled={pullOut.isPending} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition">{pullOut.isPending ? 'Submitting…' : 'Submit Request'}</button>
        </Modal>
      )}
    </div>
  )
}

function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
      <input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" autoFocus className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] py-2.5 pl-7 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm space-y-3 rounded-t-2xl border border-gray-800 bg-[#141414] p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
