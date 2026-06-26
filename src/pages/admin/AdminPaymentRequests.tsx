import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import type { Database } from '../../lib/database.types'

type PaymentRow = Database['public']['Tables']['payment_requests']['Row'] & {
  member: { full_name: string; email: string } | null
}

export default function AdminPaymentRequests() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: requests, isLoading } = useQuery({
    queryKey: ['payment-requests-admin'],
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*, member:profiles!member_id(full_name, email)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as PaymentRow[]
    },
  })

  const review = useMutation({
    mutationFn: async ({ id, status, memberId, amount, note }: {
      id: string; status: 'confirmed' | 'rejected'; memberId: string; amount: number; note: string
    }) => {
      const { error: updateError } = await supabase.from('payment_requests').update({
        status,
        admin_notes: note || null,
        reviewed_by: profile!.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)
      if (updateError) throw updateError

      if (status === 'confirmed') {
        const { error: txError } = await supabase.from('transactions').insert({
          member_id: memberId,
          type: 'credit',
          amount,
          description: 'Add funds confirmed',
          created_by: profile!.id,
          source: 'payment_request',
          reference_id: id,
        })
        if (txError) throw txError
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-requests-admin'] }),
  })

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  const pending = requests?.filter((r) => r.status === 'pending') ?? []
  const done = requests?.filter((r) => r.status !== 'pending') ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Add Funds Requests</h1>

      {pending.length === 0 && (
        <p className="text-sm text-gray-500">No pending requests.</p>
      )}

      <div className="space-y-3">
        {pending.map((r) => (
          <div key={r.id} className="rounded-xl border border-yellow-500/20 bg-[#141414] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {(r.member as any)?.full_name}
                </p>
                <p className="text-xs text-gray-500">{(r.member as any)?.email}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-semibold text-green-400">₱{Number(r.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-500">{r.payment_method}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Ref: <span className="text-gray-300">{r.reference_number}</span></p>
            {r.screenshot_url && (
              <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
              >
                View screenshot <ExternalLink size={10} />
              </a>
            )}
            <textarea
              placeholder="Admin notes (optional)"
              value={notes[r.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-violet-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => review.mutate({ id: r.id, status: 'confirmed', memberId: r.member_id, amount: Number(r.amount), note: notes[r.id] ?? '' })}
                className="flex items-center gap-1 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/20 transition-colors"
              >
                <CheckCircle size={12} /> Confirm & Credit
              </button>
              <button
                onClick={() => review.mutate({ id: r.id, status: 'rejected', memberId: r.member_id, amount: Number(r.amount), note: notes[r.id] ?? '' })}
                className="flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <XCircle size={12} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm text-gray-500">Reviewed ({done.length})</summary>
          <div className="space-y-2 mt-2">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#141414] p-3 text-sm">
                <div>
                  <p className="text-gray-300">{(r.member as any)?.full_name}</p>
                  <p className="text-xs text-gray-500">{r.reference_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-200">₱{Number(r.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                  <span className={clsx('text-xs', r.status === 'confirmed' ? 'text-green-400' : 'text-red-400')}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
