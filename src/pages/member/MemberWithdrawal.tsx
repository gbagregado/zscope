import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle } from 'lucide-react'

const schema = z.object({
  amount: z.number({ message: 'Enter an amount' }).positive('Must be positive'),
  member_payment_method: z.string().min(1, 'Required'),
  member_account_name: z.string().min(1, 'Required'),
  member_account_number: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

export default function MemberWithdrawal() {
  const { profile } = useAuthStore()
  const [success, setSuccess] = useState(false)

  const { data: balance } = useQuery({
    queryKey: ['member-balance', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('member_balances').select('balance').eq('member_id', profile!.id).single()
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const submit = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('withdrawal_requests').insert({
        member_id: profile!.id,
        ...data,
      })
      if (error) throw error
    },
    onSuccess: () => { reset(); setSuccess(true) },
  })

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
          <CheckCircle size={32} className="text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-100">Withdrawal Requested</h2>
        <p className="text-sm text-gray-500">Your request is pending admin processing.</p>
        <button onClick={() => setSuccess(false)} className="text-sm text-violet-400 hover:text-violet-300">New request</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Withdraw Funds</h1>
        <p className="mt-1 text-sm text-gray-500">Available balance: <span className="text-violet-300 font-medium">{fmt(Number(balance?.balance ?? 0))}</span></p>
      </div>

      <form onSubmit={handleSubmit((d) => submit.mutate(d))} className="space-y-4 rounded-xl border border-gray-800 bg-[#141414] p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Amount (₱)</label>
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
          <label className="mb-1 block text-xs text-gray-500">Send via (GCash, Maya, BDO, etc.)</label>
          <input
            {...register('member_payment_method')}
            className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none"
            placeholder="e.g. GCash"
          />
          {errors.member_payment_method && <p className="mt-1 text-xs text-red-400">{errors.member_payment_method.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Account name</label>
          <input
            {...register('member_account_name')}
            className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none"
            placeholder="Juan dela Cruz"
          />
          {errors.member_account_name && <p className="mt-1 text-xs text-red-400">{errors.member_account_name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Account number / mobile number</label>
          <input
            {...register('member_account_number')}
            className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none"
            placeholder="09XX-XXX-XXXX"
          />
          {errors.member_account_number && <p className="mt-1 text-xs text-red-400">{errors.member_account_number.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Submitting…' : 'Request Withdrawal'}
        </button>
      </form>
    </div>
  )
}
