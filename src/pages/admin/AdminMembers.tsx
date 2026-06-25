import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
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

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-100">Members</h1>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-[#141414] text-left text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.id} className="border-b border-gray-800/50 hover:bg-[#141414]">
                <td className="px-4 py-3 text-gray-200">{m.full_name}</td>
                <td className="px-4 py-3 text-gray-400">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium',
                    m.role === 'admin' ? 'bg-violet-500/20 text-violet-300' : 'bg-gray-800 text-gray-400'
                  )}>
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', {
                    'bg-yellow-500/10 text-yellow-400': m.status === 'pending',
                    'bg-green-500/10 text-green-400': m.status === 'active',
                    'bg-red-500/10 text-red-400': m.status === 'rejected',
                  })}>
                    {m.status === 'pending' && <Clock size={10} />}
                    {m.status === 'active' && <CheckCircle size={10} />}
                    {m.status === 'rejected' && <XCircle size={10} />}
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus.mutate({ id: m.id, status: 'active' })}
                        className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-1 text-xs text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: m.id, status: 'rejected' })}
                        className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {m.status === 'active' && (
                    <button
                      onClick={() => updateStatus.mutate({ id: m.id, status: 'rejected' })}
                      className="rounded-lg bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
