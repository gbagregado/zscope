import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useConfirm } from '../../components/ConfirmDialog'
import { Plus, Trash2 } from 'lucide-react'

const schema = z.object({
  title: z.string().min(1, 'Required'),
  body: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

export default function AdminAnnouncements() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)

  const { data: items, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const add = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('announcements').insert({ ...data, created_by: profile!.id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); reset(); setShowForm(false) },
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Announcements</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition-colors"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit((d) => add.mutate(d))} className="space-y-3 rounded-xl border border-gray-800 bg-[#141414] p-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Title</label>
            <input {...register('title')} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Message</label>
            <textarea {...register('body')} rows={4} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none resize-none" />
            {errors.body && <p className="mt-1 text-xs text-red-400">{errors.body.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
            {isSubmitting ? 'Posting…' : 'Post'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {items?.map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-800 bg-[#141414] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-200">{a.title}</p>
                <p className="mt-1 text-sm text-gray-400">{a.body}</p>
                <p className="mt-2 text-xs text-gray-600">{new Date(a.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete announcement?',
                    message: `"${a.title}" will be permanently removed for all members.`,
                    confirmText: 'Delete',
                    tone: 'danger',
                  })
                  if (ok) del.mutate(a.id)
                }}
                className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
