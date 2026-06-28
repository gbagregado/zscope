import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { CheckCircle, XCircle, Clock, Users, UserMinus, AlertTriangle, X } from 'lucide-react'
import clsx from 'clsx'

type Member = { id: string; full_name: string; email: string; role: string; status: 'pending' | 'active' | 'rejected' }

const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

export default function AdminMembers() {
  const qc = useQueryClient()
  const [revokeTarget, setRevokeTarget] = useState<Member | null>(null)
  const [revokeMode, setRevokeMode] = useState<'all' | 'capital'>('all')
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const { data: members, isLoading } = useQuery({
    queryKey: ['admin-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'active' | 'rejected' }) => {
      const { error } = await supabase.from('profiles').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members'] }),
  })

  // active investment positions of the member being revoked (for the preview)
  const { data: revokeInvestments } = useQuery({
    queryKey: ['revoke-investments', revokeTarget?.id],
    enabled: !!revokeTarget,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_balances')
        .select('investment_id, center_id, balance, total_deposits, total_profit, total_withdrawn')
        .eq('member_id', revokeTarget!.id)
        .eq('status', 'active')
      if (error) throw error
      return data ?? []
    },
  })

  const revokeMember = useMutation({
    mutationFn: async ({ memberId, mode, reason }: { memberId: string; mode: 'all' | 'capital'; reason: string }) => {
      const { error } = await supabase.rpc('revoke_member', {
        p_member_id: memberId, p_mode: mode, p_reason: reason,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members'] })
      setRevokeTarget(null); setRevokeReason(''); setRevokeError(null)
    },
    onError: (e: unknown) => setRevokeError(e instanceof Error ? e.message : 'Failed to revoke member'),
  })

  function openRevoke(m: Member) {
    setRevokeTarget(m)
    setRevokeMode('all')
    setRevokeReason('')
    setRevokeError(null)
  }

  const revokeCalc = (() => {
    const list = revokeInvestments ?? []
    let capital = 0, profit = 0, balance = 0, returned = 0
    for (const inv of list) {
      const bal = Math.max(0, Number(inv.balance))
      const cap = Math.max(0, Number(inv.total_deposits) - Number(inv.total_withdrawn))
      capital += cap
      profit += Number(inv.total_profit)
      balance += bal
      returned += revokeMode === 'all' ? bal : Math.min(cap, bal)
    }
    return { count: list.length, capital, profit, balance, returned, forfeited: balance - returned }
  })()

  function confirmRevoke() {
    if (!revokeTarget) return
    if (revokeReason.trim() === '') { setRevokeError('Please enter a reason.'); return }
    setRevokeError(null)
    revokeMember.mutate({ memberId: revokeTarget.id, mode: revokeMode, reason: revokeReason.trim() })
  }

  const pending = members?.filter((m) => m.status === 'pending') ?? []
  const others = members?.filter((m) => m.status !== 'pending') ?? []

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      Loading…
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-500">
            Pending Approval ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-yellow-500/15 bg-yellow-500/5 px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 text-xs font-semibold text-yellow-400">
                    {m.full_name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-200">{m.full_name}</p>
                    <p className="truncate text-xs text-gray-500">{m.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => updateStatus.mutate({ id: m.id, status: 'active' })}
                    className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition"
                  >
                    <CheckCircle size={12} /> Approve
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ id: m.id, status: 'rejected' })}
                    className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All members table */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          All Members ({members?.length ?? 0})
        </p>
        {others.length === 0 && pending.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-700">
            <Users size={32} />
            <p className="text-sm">No members yet.</p>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-white/6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 bg-white/3 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600">Member</th>
                <th className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 md:table-cell">Role</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {others.map((m) => (
                <tr key={m.id} className="hover:bg-white/2 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/15 text-[11px] font-semibold text-violet-400">
                        {m.full_name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{m.full_name}</p>
                        <p className="text-xs text-gray-600">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={clsx('rounded-md px-2 py-0.5 text-xs font-medium',
                      m.role === 'admin' ? 'bg-violet-500/15 text-violet-300' : 'bg-white/5 text-gray-400'
                    )}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', {
                      'bg-yellow-500/10 text-yellow-400': m.status === 'pending',
                      'bg-green-500/10 text-green-400': m.status === 'active',
                      'bg-red-500/10 text-red-400': m.status === 'rejected',
                    })}>
                      {m.status === 'pending' && <Clock size={9} />}
                      {m.status === 'active' && <CheckCircle size={9} />}
                      {m.status === 'rejected' && <XCircle size={9} />}
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.status === 'active' && (
                      <button
                        onClick={() => openRevoke(m as Member)}
                        className="flex items-center gap-1.5 rounded-lg bg-white/4 px-2.5 py-1 text-xs text-gray-500 hover:text-red-400 transition"
                      >
                        <UserMinus size={12} /> Revoke
                      </button>
                    )}
                    {m.status === 'rejected' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: m.id, status: 'active' })}
                        className="rounded-lg bg-white/4 px-2.5 py-1 text-xs text-gray-500 hover:text-green-400 transition"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke modal — global investment exit */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { if (!revokeMember.isPending) setRevokeTarget(null) }}>
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#141414] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-100"><UserMinus size={18} className="text-red-400" /> Revoke member access</h3>
              <button onClick={() => { if (!revokeMember.isPending) setRevokeTarget(null) }} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Revoke access for <span className="font-medium text-gray-200">{revokeTarget.full_name}</span>. This closes
              {' '}<span className="font-medium text-gray-200">all {revokeCalc.count} active investment{revokeCalc.count === 1 ? '' : 's'}</span> across every center and returns funds to their wallet.
            </p>

            {/* mode toggle */}
            <div className="mt-4 inline-flex w-full rounded-lg border border-gray-700 bg-[#0f0f0f] p-0.5 text-xs">
              <button onClick={() => setRevokeMode('all')} className={`flex-1 rounded-md px-3 py-2 transition ${revokeMode === 'all' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Return all (capital + profit)</button>
              <button onClick={() => setRevokeMode('capital')} className={`flex-1 rounded-md px-3 py-2 transition ${revokeMode === 'capital' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Capital only (forfeit profit)</button>
            </div>

            {/* aggregate calculation across all investments */}
            <div className="mt-4 space-y-1.5 rounded-xl border border-gray-800 bg-[#0f0f0f] p-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Active investments</span><span className="text-gray-300">{revokeCalc.count}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Total invested (capital)</span><span className="text-gray-300">{fmt(revokeCalc.capital)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Total profit</span><span className="text-green-400">{fmt(revokeCalc.profit)}</span></div>
              <div className="flex items-center justify-between border-t border-gray-800 pt-1.5"><span className="text-gray-400">Total balance</span><span className="font-medium text-gray-100">{fmt(revokeCalc.balance)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-400">Returned to wallet</span><span className="font-semibold text-violet-300">{fmt(revokeCalc.returned)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-400">Forfeited</span><span className={revokeCalc.forfeited > 0 ? 'font-semibold text-red-400' : 'text-gray-500'}>{fmt(revokeCalc.forfeited)}</span></div>
            </div>
            <p className="mt-2 text-[11px] text-gray-600">Please verify these figures before confirming. {revokeMode === 'capital' ? 'Profit will be forfeited (kept by the fund).' : 'The full balance is returned.'}</p>

            {/* reason */}
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-400">Reason (required, kept for audit)</label>
              <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={2} placeholder="e.g. Policy violation / member request" className="mt-1 w-full resize-none rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>

            {revokeError && <p className="mt-2 flex items-center gap-1 text-xs text-red-400"><AlertTriangle size={12} /> {revokeError}</p>}

            <div className="mt-4 flex gap-2">
              <button onClick={() => { if (!revokeMember.isPending) setRevokeTarget(null) }} className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition">Cancel</button>
              <button onClick={confirmRevoke} disabled={revokeMember.isPending} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition">
                <UserMinus size={15} /> {revokeMember.isPending ? 'Revoking…' : `Revoke — return ${fmt(revokeCalc.returned)}`}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-gray-600">Each closed position is logged and can be undone per-investment from its center if you restore the member.</p>
          </div>
        </div>
      )}
    </div>
  )
}
