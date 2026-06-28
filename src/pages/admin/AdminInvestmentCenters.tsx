import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useConfirm } from '../../components/ConfirmDialog'
import { Plus, Trash2, Upload, Building2, Pencil, Lock, Unlock, Info, X } from 'lucide-react'
import type { Database } from '../../lib/database.types'

type Center = Database['public']['Tables']['investment_centers']['Row']

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  expected_return_pct: z.number().min(0),
  min_investment: z.number().min(0),
  maintaining_balance: z.number().min(0),
  fund_cap: z.number().min(0),
  max_per_member: z.number().min(0),
  lock_in_mode: z.enum(['none', 'duration', 'date']),
  lock_in_months: z.number().int().min(0),
  lock_in_days: z.number().int().min(0),
  lock_in_until: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function AdminInvestmentCenters() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Center | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const { data: centers, isLoading } = useQuery({
    queryKey: ['investment-centers-admin'],
    queryFn: async (): Promise<Center[]> => {
      const { data, error } = await supabase
        .from('investment_centers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expected_return_pct: 0, min_investment: 0, maintaining_balance: 0, fund_cap: 0, max_per_member: 0, lock_in_mode: 'none', lock_in_months: 0, lock_in_days: 0, lock_in_until: '' },
  })
  const lockMode = watch('lock_in_mode')

  const save = useMutation({
    mutationFn: async (data: FormData & { image_url?: string | null; storage_path?: string | null }) => {
      if (editing) {
        const patch: Database['public']['Tables']['investment_centers']['Update'] = {
          name: data.name,
          description: data.description || null,
          expected_return_pct: data.expected_return_pct,
          min_investment: data.min_investment,
          maintaining_balance: data.maintaining_balance,
          fund_cap: data.fund_cap,
          max_per_member: data.max_per_member,
          lock_in_months: data.lock_in_months,
          lock_in_days: data.lock_in_days,
          lock_in_until: data.lock_in_until || null,
        }
        if (data.image_url || data.storage_path) {
          patch.image_url = data.image_url ?? null
          patch.storage_path = data.storage_path ?? null
        }
        const { error } = await supabase.from('investment_centers').update(patch).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('investment_centers').insert({
          name: data.name,
          description: data.description || null,
          expected_return_pct: data.expected_return_pct,
          min_investment: data.min_investment,
          maintaining_balance: data.maintaining_balance,
          fund_cap: data.fund_cap,
          max_per_member: data.max_per_member,
          lock_in_months: data.lock_in_months,
          lock_in_days: data.lock_in_days,
          lock_in_until: data.lock_in_until || null,
          image_url: data.image_url ?? null,
          storage_path: data.storage_path ?? null,
          created_by: profile!.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investment-centers-admin'] }); closeForm() },
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
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed to remove center. It may still have related records.'),
  })

  const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  function lockInLabel(c: Center): string {
    if (c.lock_in_until) {
      return `Until ${new Date(c.lock_in_until + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
    }
    const months = c.lock_in_months || 0
    const days = c.lock_in_days ?? 0
    if (months <= 0 && days <= 0) return 'None'
    const parts: string[] = []
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`)
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`)
    return parts.join(' ')
  }

  function openNew() {
    setEditing(null)
    setImage(null)
    setError('')
    reset({ name: '', description: '', expected_return_pct: 0, min_investment: 0, maintaining_balance: 0, fund_cap: 0, max_per_member: 0, lock_in_mode: 'none', lock_in_months: 0, lock_in_days: 0, lock_in_until: '' })
    setShowForm(true)
  }

  function openEdit(c: Center) {
    setEditing(c)
    setImage(null)
    setError('')
    reset({
      name: c.name,
      description: c.description ?? '',
      expected_return_pct: c.expected_return_pct,
      min_investment: c.min_investment,
      maintaining_balance: c.maintaining_balance,
      fund_cap: c.fund_cap,
      max_per_member: c.max_per_member,
      lock_in_mode: c.lock_in_until ? 'date' : (c.lock_in_months > 0 || c.lock_in_days > 0 ? 'duration' : 'none'),
      lock_in_months: c.lock_in_months,
      lock_in_days: c.lock_in_days ?? 0,
      lock_in_until: c.lock_in_until ?? '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setImage(null)
    setError('')
    reset({ name: '', description: '', expected_return_pct: 0, min_investment: 0, maintaining_balance: 0, fund_cap: 0, max_per_member: 0, lock_in_mode: 'none', lock_in_months: 0, lock_in_days: 0, lock_in_until: '' })
  }

  async function onSubmit(data: FormData) {
    setError('')
    // normalize lock-in based on the chosen mode
    let lock_in_months = 0, lock_in_days = 0
    let lock_in_until: string | null = null
    if (data.lock_in_mode === 'duration') {
      lock_in_months = data.lock_in_months || 0
      lock_in_days = data.lock_in_days || 0
    } else if (data.lock_in_mode === 'date') {
      if (!data.lock_in_until) { setError('Please choose a lock-in end date.'); return }
      lock_in_until = data.lock_in_until
    }
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
    save.mutate({ ...data, lock_in_months, lock_in_days, lock_in_until: lock_in_until ?? '', image_url, storage_path })
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Investment Centers</h1>
        <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition-colors">
          <Plus size={16} /> New
        </button>
      </div>

      {!showForm && error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border border-gray-800 bg-[#141414] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-200">{editing ? 'Edit Center' : 'New Center'}</p>
            <button type="button" onClick={closeForm} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
          </div>
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
              <label className="mb-1 block text-xs text-gray-500">Min Investment ($)</label>
              <input type="number" step="0.01" {...register('min_investment', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Maintaining Balance ($)</label>
              <input type="number" step="0.01" {...register('maintaining_balance', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Fund Cap ($) <span className="text-gray-600">— max total funds; 0 = unlimited</span></label>
            <input type="number" step="0.01" {...register('fund_cap', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Max Per Member ($) <span className="text-gray-600">— cap per single member; 0 = unlimited</span></label>
            <input type="number" step="0.01" {...register('max_per_member', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#0f0f0f] p-3">
            <label className="mb-1.5 block text-xs font-medium text-gray-400">Lock-in Period <span className="text-gray-600">— no adding or withdrawing while locked</span></label>
            <div className="inline-flex w-full rounded-lg border border-gray-700 bg-[#141414] p-0.5 text-xs">
              <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-md px-2 py-1.5 transition ${lockMode === 'none' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <input type="radio" value="none" {...register('lock_in_mode')} className="hidden" /> No lock-in
              </label>
              <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-md px-2 py-1.5 transition ${lockMode === 'duration' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <input type="radio" value="duration" {...register('lock_in_mode')} className="hidden" /> Duration
              </label>
              <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-md px-2 py-1.5 transition ${lockMode === 'date' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <input type="radio" value="date" {...register('lock_in_mode')} className="hidden" /> Fixed end date
              </label>
            </div>

            {lockMode === 'duration' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">Months</label>
                  <input type="number" step="1" min="0" {...register('lock_in_months', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#141414] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">Days</label>
                  <input type="number" step="1" min="0" {...register('lock_in_days', { valueAsNumber: true })} className="w-full rounded-lg border border-gray-700 bg-[#141414] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
                </div>
                <p className="col-span-2 text-[11px] text-gray-600">Counted from each member's join date. Months and days add together.</p>
              </div>
            )}

            {lockMode === 'date' && (
              <div className="mt-3">
                <label className="mb-1 block text-[11px] text-gray-500">Locked until (calendar date)</label>
                <input type="date" {...register('lock_in_until')} className="w-full rounded-lg border border-gray-700 bg-[#141414] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none" />
                <p className="mt-1 text-[11px] text-gray-600">Same end date for every member, regardless of when they joined.</p>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Image <span className="text-gray-600">(optional{editing ? ' — leave empty to keep current' : ''})</span></label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-700 bg-[#0f0f0f] p-3 transition hover:border-violet-500/60 hover:bg-violet-500/5">
              {image ? (
                <img src={URL.createObjectURL(image)} alt="preview" className="h-14 w-14 rounded-lg border border-gray-700 object-cover" />
              ) : editing?.image_url ? (
                <img src={editing.image_url} alt="current" className="h-14 w-14 rounded-lg border border-gray-700 object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-700 bg-[#141414] text-gray-600"><Building2 size={20} /></div>
              )}
              <div className="flex flex-1 items-center gap-2 text-sm text-gray-400"><Upload size={15} /><span>{image ? image.name : 'Click to attach an image'}</span></div>
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
          </div>
          <button type="submit" disabled={isSubmitting || uploading} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
            {isSubmitting || uploading ? 'Saving…' : editing ? 'Save Changes' : 'Create Center'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {centers?.length === 0 && <p className="text-sm text-gray-600">No investment centers yet.</p>}
        {centers?.map((c) => (
          <div key={c.id} className="rounded-xl border border-gray-800 bg-[#141414] p-4">
            <div className="flex items-start gap-3">
              {/* Icon / thumbnail */}
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Building2 size={22} /></div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-100">{c.name}</p>
                    {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{c.description}</p>}
                  </div>
                  {/* Status badge */}
                  <span className={c.is_active
                    ? 'flex shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-400'
                    : 'flex shrink-0 items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-400'}>
                    {c.is_active ? <Unlock size={11} /> : <Lock size={11} />}
                    {c.is_active ? 'Active' : 'Locked'}
                  </span>
                </div>

                {/* Stats — two columns */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-gray-500">Min. Investment</p>
                    <p className="text-sm font-medium text-gray-200">{fmt(c.min_investment)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">Expected Return</p>
                    <p className="text-sm font-medium text-green-400">{c.expected_return_pct}%</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-600">Maintaining balance: {fmt(c.maintaining_balance)}</p>
                <p className="mt-0.5 text-[11px] text-gray-600">Fund cap: {c.fund_cap > 0 ? fmt(c.fund_cap) : 'Unlimited'}</p>
                <p className="mt-0.5 text-[11px] text-gray-600">Max per member: {c.max_per_member > 0 ? fmt(c.max_per_member) : 'Unlimited'}</p>
                <p className="mt-0.5 text-[11px] text-gray-600">Lock-in: {lockInLabel(c)}</p>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => openEdit(c)} className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-violet-500/60 hover:text-white transition">
                    <Pencil size={13} /> Edit
                  </button>
                  <button onClick={() => toggle.mutate({ id: c.id, is_active: !c.is_active })} className={c.is_active
                    ? 'flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 transition'
                    : 'flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/10 transition'}>
                    {c.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                    {c.is_active ? 'Lock' : 'Unlock'}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({ title: 'Remove center?', message: `"${c.name}" and all related investment data references will be removed.`, confirmText: 'Remove', tone: 'danger' })
                      if (ok) { setError(''); del.mutate({ id: c.id, storage_path: c.storage_path }) }
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-gray-600">
        <Info size={12} /> Locked centers are not visible to members.
      </p>
    </div>
  )
}
