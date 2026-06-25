import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react'
import clsx from 'clsx'

export default function AdminMembers() {
  const qc = useQueryClient()

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
                        onClick={() => updateStatus.mutate({ id: m.id, status: 'rejected' })}
                        className="rounded-lg bg-white/4 px-2.5 py-1 text-xs text-gray-500 hover:text-red-400 transition"
                      >
                        Revoke
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
    </div>
  )
}
