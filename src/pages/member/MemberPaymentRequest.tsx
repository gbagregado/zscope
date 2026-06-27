import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle, AlertCircle } from 'lucide-react'

const schema = z.object({
  amount: z.number({ message: 'Enter an amount' }).positive('Must be positive'),
  payment_method: z.string().min(1, 'Select a payment method'),
  reference_number: z.string().min(1, 'Reference number is required'),
})
type FormData = z.infer<typeof schema>

export default function MemberPaymentRequest() {
  const { profile } = useAuthStore()
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_methods').select('*').eq('is_active', true)
      if (error) throw error
      return data
    },
  })

  const [selectedMethod, setSelectedMethod] = useState<string>('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const submit = useMutation({
    mutationFn: async (data: FormData & { screenshot_url?: string }) => {
      const { error } = await supabase.from('payment_requests').insert({
        member_id: profile!.id,
        amount: data.amount,
        payment_method: data.payment_method,
        reference_number: data.reference_number,
        screenshot_url: data.screenshot_url ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => { reset(); setScreenshot(null); setSelectedMethod(''); setSuccess(true); setSubmitError('') },
    onError: (e: unknown) => setSubmitError(e instanceof Error ? e.message : 'Failed to submit request'),
  })

  async function onSubmit(data: FormData) {
    setSubmitError('')
    let screenshot_url: string | undefined
    if (screenshot) {
      const ext = screenshot.name.split('.').pop()
      const path = `${profile!.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, screenshot)
      if (upErr) {
        setSubmitError(`Screenshot upload failed: ${upErr.message}. You can submit without a screenshot, or ask the admin to apply storage policies.`)
        return
      }
      const { data: signed } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 60 * 24 * 365)
      screenshot_url = signed?.signedUrl
    }
    submit.mutate({ ...data, screenshot_url })
  }

  const activeMethod = methods?.find((m) => m.name === selectedMethod)

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
          <CheckCircle size={32} className="text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-100">Request Submitted</h2>
        <p className="text-sm text-gray-500">Your payment request is pending admin confirmation.</p>
        <button onClick={() => setSuccess(false)} className="text-sm text-violet-400 hover:text-violet-300">Submit another</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-xl font-semibold text-gray-100">Add Funds</h1>

      {/* QR Code display */}
      {methods && methods.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Choose a payment method to send funds:</p>
          <div className="grid gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMethod(selectedMethod === m.name ? '' : m.name)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  selectedMethod === m.name ? 'border-violet-500/50 bg-violet-500/10' : 'border-gray-800 bg-[#141414] hover:border-gray-700'
                }`}
              >
                {m.qr_image_url && <img src={m.qr_image_url} alt="QR" className="h-12 w-12 rounded-lg object-cover" />}
                <div>
                  <p className="text-sm font-medium text-gray-200">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.account_name} · {m.account_number}</p>
                </div>
              </button>
            ))}
          </div>
          {activeMethod?.qr_image_url && (
            <div className="flex justify-center">
              <img src={activeMethod.qr_image_url} alt="QR Code" className="w-48 h-48 rounded-xl border border-gray-700 object-contain bg-white p-2" />
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-800 bg-[#141414] p-4">
        <h2 className="text-sm font-medium text-gray-300">Payment Details</h2>

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
            <p className="text-xs text-red-300">{submitError}</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-gray-500">Payment method used</label>
          <select
            {...register('payment_method')}
            onChange={(e) => { register('payment_method').onChange(e); setSelectedMethod(e.target.value) }}
            className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none"
          >
            <option value="">Select…</option>
            {methods?.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
          {errors.payment_method && <p className="mt-1 text-xs text-red-400">{errors.payment_method.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Amount ($)</label>
          <input
            {...register('amount', { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="1"
            className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none"
            placeholder="0.00"
          />
          {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Transaction signature / hash</label>
          <input
            {...register('reference_number')}
            className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none"
            placeholder="Solana transaction signature (TXID)"
          />
          {errors.reference_number && <p className="mt-1 text-xs text-red-400">{errors.reference_number.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Screenshot (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            className="text-xs text-gray-400"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
