import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { TrendingUp, Search } from 'lucide-react'

type ProfitRow = {
  id: string
  amount: number
  description: string
  created_at: string
  member: { full_name: string } | null
}

export default function AdminProfits() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  const { data: members, isLoading } = useQuery({
    queryKey: ['admin-profit-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_balances')
        .select('*')
        .order('full_name', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const { data: recentProfits } = useQuery({
    queryKey: ['admin-recent-profits'],
    queryFn: async (): Promise<ProfitRow[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, description, created_at, member:profiles!member_id(full_name)')
        .eq('source', 'profit')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as unknown as ProfitRow[]
    },
  })

  const addProfit = useMutation({
    mutationFn: async ({ memberId, amount, note }: { memberId: string; amount: number; note: string }) => {
      const { error } = await supabase.from('transactions').insert({
        member_id: memberId,
        type: 'credit',
        amount,
        description: note || 'Profit',
        created_by: profile!.id,
        source: 'profit',
        reference_id: null,
      })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-profit-members'] })
      qc.invalidateQueries({ queryKey: ['admin-recent-profits'] })
      setAmounts((a) => ({ ...a, [vars.memberId]: '' }))
      setNotes((n) => ({ ...n, [vars.memberId]: '' }))
      setFeedback({ id: vars.memberId, msg: 'Profit added', ok: true })
      setTimeout(() => setFeedback(null), 2500)
    },
    onError: (e: unknown, vars) => {
      setFeedback({ id: vars.memberId, msg: e instanceof Error ? e.message : 'Failed', ok: false })
    },
  })

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  function submit(memberId: string) {
    const raw = amounts[memberId]
    const amount = Number(raw)
    if (!raw || isNaN(amount) || amount <= 0) {
      setFeedback({ id: memberId, msg: 'Enter a valid amount', ok: false })
      return
    }
    addProfit.mutate({ memberId, amount, note: notes[memberId] ?? '' })
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  const filtered = (members ?? []).filter((m) =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Add Profit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Record profit for a member. It is added to their balance and shown as profit on their dashboard.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search member by name or email"
          className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
        />
      </div>

      {/* Members */}
      <div className="space-y-2.5">
        {filtered.length === 0 && <p className="text-sm text-gray-600">No members found.</p>}
        {filtered.map((m) => (
          <div key={m.member_id} className="rounded-xl border border-gray-800 bg-[#141414] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/15 text-xs font-semibold text-violet-400">
                  {m.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-200">{m.full_name}</p>
                  <p className="truncate text-xs text-gray-600">Balance: {fmt(Number(m.balance ?? 0))}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-40">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₱</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amounts[m.member_id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [m.member_id]: e.target.value }))}
                  placeholder="Amount"
                  className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] py-2 pl-7 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
                />
              </div>
              <input
                value={notes[m.member_id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [m.member_id]: e.target.value }))}
                placeholder="Note (optional)"
                className="flex-1 rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => submit(m.member_id)}
                disabled={addProfit.isPending}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                <TrendingUp size={15} /> Add Profit
              </button>
            </div>
            {feedback?.id === m.member_id && (
              <p className={feedback.ok ? 'mt-2 text-xs text-green-400' : 'mt-2 text-xs text-red-400'}>{feedback.msg}</p>
            )}
          </div>
        ))}
      </div>

      {/* Recent profits */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-400">Recent Profit Entries</h2>
        {(recentProfits?.length ?? 0) === 0 && <p className="text-sm text-gray-600">No profit added yet.</p>}
        <div className="space-y-2">
          {recentProfits?.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#141414] px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-300">{p.member?.full_name ?? 'Member'}</p>
                <p className="truncate text-xs text-gray-600">
                  {p.description} · {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <p className="text-sm font-medium text-green-400">+{fmt(Number(p.amount))}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
