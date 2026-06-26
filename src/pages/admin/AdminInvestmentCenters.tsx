import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useConfirm } from '../../components/ConfirmDialog'
import { Plus, Trash2, ToggleLeft, ToggleRight, Upload, Building2 } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  expected_return_pct: z.number().min(0),
  min_investment: z.number().min(0),
  maintaining_balance: z.number().min(0),
})
type FormData = z.infer<typeof schema>

export default function AdminInvestmentCenters() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const { data: centers, isLoading } = useQuery({
    queryKey: ['investment-centers-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_centers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expected_return_pct: 0, min_investment: 0, maintaining_balance: 0 },
  })

  const add = useMutation({
    mutationFn: async (data: FormData & { image_url?: string | null; storage_path?: string | null }) => {
      const { error } = await supabase.from('investment_centers').insert({
        name: data.name,
        description: data.description || null,
        expected_return_pct: data.expected_return_pct,
        min_investment: data.min_investment,
        maintaining_balance: data.maintaining_balance,
        image_url: data.image_url ?? null,
        storage_path: data.storage_path ?? null,
        created_by: profile!.id,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investment-centers-admin'] }); reset(); setShowForm(false); setImage(null); setError('') },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save center'),
  })

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('investment_centers').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment-centers-admin'] }),
  })

  const del = useMutation({
    mutationFn: async (c: { id: string; storage_path: string | null }) => {
      if (c.storage_path) await supabase.storage.from('investment-centers').remove([c.storage_path])
      const { error } = await supabase.from('investment_centers').delete().eq('id', c.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment-centers-admin'] }),
  })

  const fmt = (n: number) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  async function onSubmit(data: FormData) {
    setError('')
    let image_url: string | null = null
    let storage_path: string | null = null
    if (image) {
      setUploading(true)
      const ext = image.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('investment-centers').upload(path, image)
      setUploading(false)
      if (upErr) { setError(`Image upload failed: ${upErr.message}. Make sure investment storage policies are applied.`); return }
      const { data: urlData } = supabase.storage.from('investment-centers').getPublicUrl(path)
      image_url = urlData.publicUrl
      storage_path = path
    }
    add.mutate({ ...data, image_url, storage_path })
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Investment Centers</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition-colors">
          <Plus size={16} /> New
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border border-gray-800 bg-[#141414] p-4">
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
          <div>
            <label className="mb-1 block text-xs text-gray-500">Name</label>
            <input {...register('name')} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Description</label>
            <textarea {...register('description')} rows={3} className="w-full resize-none rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Expected Return %</label>
              <input type="number" step="0.01" {...register('expected_return_pct', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Min Investment (₱)</label>
              <input type="number" step="0.01" {...register('min_investment', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Maintaining Balance (₱)</label>
              <input type="number" step="0.01" {...register('maintaining_balance', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Banner image <span className="text-gray-600">(optional)</span></label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-700 bg-[#0f0f0f] p-3 transition hover:border-violet-500/60 hover:bg-violet-500/5">
              {image ? (
                <img src={URL.createObjectURL(image)} alt="preview" className="h-16 w-28 rounded-lg border border-gray-700 object-cover" />
              ) : (
                <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-gray-700 bg-[#141414] text-gray-600"><Building2 size={22} /></div>
              )}
              <div className="flex flex-1 items-center gap-2 text-sm text-gray-400"><Upload size={15} /><span>{image ? image.name : 'Click to attach an image'}</span></div>
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
          </div>
          <button type="submit" disabled={isSubmitting || uploading} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
            {isSubmitting || uploading ? 'Saving…' : 'Create Center'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {centers?.length === 0 && <p className="text-sm text-gray-600">No investment centers yet.</p>}
        {centers?.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-xl border border-gray-800 bg-[#141414]">
            {c.image_url && <img src={c.image_url} alt={c.name} className="h-32 w-full object-cover" />}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-100">{c.name}</p>
                  {c.description && <p className="mt-0.5 text-xs text-gray-500">{c.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => toggle.mutate({ id: c.id, is_active: !c.is_active })} className={c.is_active ? 'text-green-400' : 'text-gray-600'} title={c.is_active ? 'Active' : 'Hidden'}>
                    {c.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({ title: 'Delete center?', message: `"${c.name}" and all related investment data references will be removed.`, confirmText: 'Delete', tone: 'danger' })
                      if (ok) del.mutate({ id: c.id, storage_path: c.storage_path })
                    }}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Return: <span className="text-green-400">{c.expected_return_pct}%</span></span>
                <span>Min: <span className="text-gray-300">{fmt(c.min_investment)}</span></span>
                <span>Maintaining: <span className="text-gray-300">{fmt(c.maintaining_balance)}</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
