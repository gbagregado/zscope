import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  account_name: z.string().min(1, 'Required'),
  account_number: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

export default function AdminPaymentMethods() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [qrFile, setQrFile] = useState<File | null>(null)

  const { data: methods, isLoading } = useQuery({
    queryKey: ['payment-methods-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_methods').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const addMethod = useMutation({
    mutationFn: async (data: FormData & { qr_image_url?: string }) => {
      const { error } = await supabase.from('payment_methods').insert(data)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods-admin'] }); reset(); setShowForm(false); setQrFile(null) },
  })

  const toggleMethod = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('payment_methods').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods-admin'] }),
  })

  const deleteMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods-admin'] }),
  })

  async function onSubmit(data: FormData) {
    let qr_image_url: string | undefined
    if (qrFile) {
      setUploading(true)
      const ext = qrFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('qr-codes').upload(path, qrFile)
      setUploading(false)
      if (uploadError) return
      const { data: urlData } = supabase.storage.from('qr-codes').getPublicUrl(path)
      qr_image_url = urlData.publicUrl
    }
    addMethod.mutate({ ...data, qr_image_url })
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Payment Methods</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border border-gray-800 bg-[#141414] p-4">
          <h2 className="text-sm font-medium text-gray-300">New Payment Method</h2>
          {['name', 'account_name', 'account_number'].map((field) => (
            <div key={field}>
              <label className="mb-1 block text-xs text-gray-500 capitalize">{field.replace('_', ' ')}</label>
              <input
                {...register(field as keyof FormData)}
                className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none"
              />
              {errors[field as keyof FormData] && (
                <p className="mt-1 text-xs text-red-400">{errors[field as keyof FormData]?.message}</p>
              )}
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-gray-500">QR Code Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setQrFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || uploading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting || uploading ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {methods?.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#141414] p-4">
            <div className="flex items-center gap-3">
              {m.qr_image_url && (
                <img src={m.qr_image_url} alt="QR" className="h-12 w-12 rounded-lg object-cover" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-200">{m.name}</p>
                <p className="text-xs text-gray-500">{m.account_name} · {m.account_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleMethod.mutate({ id: m.id, is_active: !m.is_active })}
                className={m.is_active ? 'text-green-400' : 'text-gray-600'}
              >
                {m.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
              <button
                onClick={() => { if (confirm('Delete this payment method?')) deleteMethod.mutate(m.id) }}
                className="text-gray-600 hover:text-red-400 transition-colors"
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
