import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useConfirm } from '../../components/ConfirmDialog'
import { Plus, Trash2, Upload, Image as ImageIcon, Pencil, X } from 'lucide-react'

const schema = z.object({
  title: z.string().min(1, 'Required'),
  body: z.string().min(1, 'Required'),
  show_as_popup: z.boolean(),
})
type FormData = z.infer<typeof schema>

export default function AdminAnnouncements() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<{ id: string; storage_path: string | null; image_url: string | null } | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

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
    defaultValues: { show_as_popup: false },
  })

  const add = useMutation({
    mutationFn: async (data: FormData & { image_url?: string | null; storage_path?: string | null }) => {
      const { error } = await supabase.from('announcements').insert({ ...data, created_by: profile!.id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); closeForm() },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed to post announcement'),
  })

  const update = useMutation({
    mutationFn: async ({ id, oldStoragePath, image_url, storage_path, ...data }: FormData & { id: string; oldStoragePath: string | null; image_url?: string | null; storage_path?: string | null }) => {
      const patch = image_url !== undefined ? { ...data, image_url, storage_path } : { ...data }
      const { error } = await supabase.from('announcements').update(patch).eq('id', id)
      if (error) throw error
      if (image_url !== undefined && oldStoragePath) {
        await supabase.storage.from('announcements').remove([oldStoragePath])
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); closeForm() },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed to update announcement'),
  })

  function closeForm() {
    reset({ title: '', body: '', show_as_popup: false })
    setShowForm(false)
    setEditing(null)
    setImage(null)
    setError('')
  }

  function openEdit(a: { id: string; title: string; body: string; show_as_popup: boolean; storage_path: string | null; image_url: string | null }) {
    setEditing({ id: a.id, storage_path: a.storage_path, image_url: a.image_url })
    setImage(null)
    setError('')
    reset({ title: a.title, body: a.body, show_as_popup: a.show_as_popup })
    setShowForm(true)
  }

  const del = useMutation({
    mutationFn: async (item: { id: string; storage_path: string | null }) => {
      if (item.storage_path) {
        await supabase.storage.from('announcements').remove([item.storage_path])
      }
      const { error } = await supabase.from('announcements').delete().eq('id', item.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  async function onSubmit(data: FormData) {
    setError('')
    let image_url: string | null | undefined = undefined
    let storage_path: string | null | undefined = undefined
    if (image) {
      setUploading(true)
      const ext = image.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('announcements').upload(path, image)
      setUploading(false)
      if (upErr) {
        setError(`Image upload failed: ${upErr.message}. Make sure the announcements storage policies are applied.`)
        return
      }
      const { data: urlData } = supabase.storage.from('announcements').getPublicUrl(path)
      image_url = urlData.publicUrl
      storage_path = path
    }
    if (editing) {
      update.mutate({ ...data, id: editing.id, oldStoragePath: editing.storage_path, image_url, storage_path })
    } else {
      add.mutate({ ...data, image_url: image_url ?? null, storage_path: storage_path ?? null })
    }
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Announcements</h1>
        <button
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition-colors"
        >
          {showForm ? <><X size={16} /> Close</> : <><Plus size={16} /> New</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border border-gray-800 bg-[#141414] p-4">
          <p className="text-sm font-medium text-gray-300">{editing ? 'Edit announcement' : 'New announcement'}</p>
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
          )}
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
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Image <span className="text-gray-600">(optional)</span></label>            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-700 bg-[#0f0f0f] p-3 transition hover:border-violet-500/60 hover:bg-violet-500/5">
              {image ? (
                <img src={URL.createObjectURL(image)} alt="preview" className="h-16 w-28 rounded-lg border border-gray-700 object-cover" />
              ) : editing?.image_url ? (
                <img src={editing.image_url} alt="current" className="h-16 w-28 rounded-lg border border-gray-700 object-cover" />
              ) : (
                <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-gray-700 bg-[#141414] text-gray-600">
                  <ImageIcon size={22} />
                </div>
              )}
              <div className="flex flex-1 items-center gap-2 text-sm text-gray-400">
                <Upload size={15} />
                <span>{image ? image.name : editing?.image_url ? 'Click to replace image' : 'Click to attach an image'}</span>
              </div>
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-700 bg-[#0f0f0f] p-3">
            <input type="checkbox" {...register('show_as_popup')} className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600" />
            <span className="text-xs text-gray-300">
              Show as login pop-up
              <span className="mt-0.5 block text-[11px] text-gray-600">Members see this once after they log in. Only the most recent pop-up announcement is shown.</span>
            </span>
          </label>
          <button type="submit" disabled={isSubmitting || uploading} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
            {isSubmitting || uploading ? 'Saving…' : editing ? 'Save changes' : 'Post'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {items?.map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-800 bg-[#141414] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-gray-200">{a.title}</p>
                  {a.show_as_popup && (
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">Login pop-up</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-400">{a.body}</p>
                {a.image_url && (
                  <img src={a.image_url} alt={a.title} className="mt-3 max-h-48 w-full rounded-lg border border-gray-800 object-cover" />
                )}
                <p className="mt-2 text-xs text-gray-600">{new Date(a.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={() => openEdit(a)}
                  className="text-gray-600 hover:text-violet-400 transition-colors"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete announcement?',
                      message: `"${a.title}" will be permanently removed for all members.`,
                      confirmText: 'Delete',
                      tone: 'danger',
                    })
                    if (ok) del.mutate({ id: a.id, storage_path: a.storage_path })
                  }}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
