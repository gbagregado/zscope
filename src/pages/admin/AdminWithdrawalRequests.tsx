import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import type { Database } from '../../lib/database.types'
import { useConfirm } from '../../components/ConfirmDialog'

type WithdrawalRow = Database['public']['Tables']['withdrawal_requests']['Row'] & {
  member: { full_name: string; email: string } | null
}

export default function AdminWithdrawalRequests() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const confirm = useConfirm()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [proofFiles, setProofFiles] = useState<Record<string, File>>({})

  const { data: requests, isLoading } = useQuery({
    queryKey: ['withdrawal-requests-admin'],
    queryFn: async (): Promise<WithdrawalRow[]> => {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*, member:profiles!member_id(full_name, email)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as WithdrawalRow[]
    },
  })

  const review = useMutation({
    mutationFn: async ({ id, status, memberId, amount, note, ref }: {
      id: string; status: 'approved' | 'rejected'; memberId: string; amount: number; note: string; ref: string
    }) => {
      let proof_url: string | undefined
      const file = proofFiles[id]
      if (file && status === 'approved') {
        const ext = file.name.split('.').pop()
        const path = `withdrawals/${id}.${ext}`
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 60 * 24 * 365)
        proof_url = urlData?.signedUrl
      }

      const { error: updateError } = await supabase.from('withdrawal_requests').update({
        status,
        admin_notes: note || null,
        reference_number: ref || null,
        proof_url: proof_url ?? null,
        reviewed_by: profile!.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)
      if (updateError) throw updateError

      if (status === 'approved') {
        const { error: txError } = await supabase.from('transactions').insert({
          member_id: memberId,
          type: 'debit',
          amount,
          description: 'Withdrawal approved',
          created_by: profile!.id,
          source: 'withdrawal',
          reference_id: id,
        })
        if (txError) throw txError
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['withdrawal-requests-admin'] }),
  })

  const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  async function approveRequest(r: WithdrawalRow) {
    const ok = await confirm({
      title: 'Approve & debit withdrawal',
      message: `Approve paying out ${fmt(Number(r.amount))} to ${(r.member as any)?.full_name ?? 'this member'}? This debits their wallet. Send the funds to ${r.member_payment_method} (${r.member_account_number}) first.`,
      confirmText: 'Approve & debit',
    })
    if (!ok) return
    review.mutate({ id: r.id, status: 'approved', memberId: r.member_id, amount: Number(r.amount), note: notes[r.id] ?? '', ref: refs[r.id] ?? '' })
  }
  async function rejectRequest(r: WithdrawalRow) {
    const ok = await confirm({
      title: 'Reject withdrawal',
      message: `Reject ${(r.member as any)?.full_name ?? 'this member'}'s withdrawal of ${fmt(Number(r.amount))}?`,
      confirmText: 'Reject',
      tone: 'danger',
    })
    if (!ok) return
    review.mutate({ id: r.id, status: 'rejected', memberId: r.member_id, amount: Number(r.amount), note: notes[r.id] ?? '', ref: refs[r.id] ?? '' })
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  const pending = requests?.filter((r) => r.status === 'pending') ?? []
  const done = requests?.filter((r) => r.status !== 'pending') ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Withdrawal Requests</h1>

      {pending.length === 0 && <p className="text-sm text-gray-500">No pending withdrawals.</p>}

      <div className="space-y-3">
        {pending.map((r) => (
          <div key={r.id} className="rounded-xl border border-yellow-500/20 bg-[#141414] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-200">{(r.member as any)?.full_name}</p>
                <p className="text-xs text-gray-500">{(r.member as any)?.email}</p>
              </div>
              <p className="text-base font-semibold text-red-400">${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <p>Chain / Network: <span className="text-gray-300">{r.member_payment_method}</span></p>
              <p>Wallet address: <span className="break-all text-gray-300">{r.member_account_number}</span></p>
            </div>
            <input
              placeholder="Reference number"
              value={refs[r.id] ?? ''}
              onChange={(e) => setRefs((n) => ({ ...n, [r.id]: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
            />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Proof of transfer (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setProofFiles((p) => ({ ...p, [r.id]: f })) }}
                className="text-xs text-gray-400"
              />
            </div>
            <textarea
              placeholder="Admin notes (optional)"
              value={notes[r.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-violet-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => approveRequest(r)}
                className="flex items-center gap-1 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/20 transition-colors"
              >
                <CheckCircle size={12} /> Approve & Debit
              </button>
              <button
                onClick={() => rejectRequest(r)}
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
                  <p className="break-all text-xs text-gray-500">{r.member_payment_method} · {r.member_account_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-200">${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <div className="flex items-center gap-1 justify-end">
                    <span className={clsx('text-xs', r.status === 'approved' ? 'text-green-400' : 'text-red-400')}>{r.status}</span>
                    {r.proof_url && (
                      <a href={r.proof_url} target="_blank" rel="noopener noreferrer" className="text-violet-400">
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
