import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle, AlertCircle, MapPin, Wallet } from 'lucide-react'

const schema = z.object({
  address: z.string().min(5, 'Please enter your full address'),
  payout_network: z.string().min(1, 'Please select a network'),
  wallet_address: z.string().min(20, 'Wallet address looks too short').max(120, 'Wallet address looks too long'),
})
type FormData = z.infer<typeof schema>

const NETWORKS = ['Solana', 'Ethereum (ERC-20)', 'BNB Smart Chain (BEP-20)', 'Polygon', 'Tron (TRC-20)', 'Bitcoin', 'Arbitrum', 'Base', 'Other']

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:border-violet-500 focus:bg-white/[0.05] focus:ring-4 focus:ring-violet-500/10"

export default function MemberProfile() {
  const { profile, session, fetchProfile } = useAuthStore()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      address: profile?.address ?? '',
      payout_network: profile?.payout_network ?? '',
      wallet_address: profile?.wallet_address ?? '',
    },
  })

  async function onSubmit(data: FormData) {
    setError('')
    setSaved(false)
    const { error: rpcError } = await supabase.rpc('update_my_account_info', {
      p_address: data.address,
      p_payout_network: data.payout_network,
      p_wallet_address: data.wallet_address,
    })
    if (rpcError) { setError(rpcError.message); return }
    if (session) await fetchProfile(session.user.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Payout details</h2>
        <p className="mt-1 text-sm text-gray-500">Keep your address and main Solana account up to date so we always know where to send your funds.</p>
      </div>

      {/* Read-only identity */}
      <div className="rounded-xl border border-white/6 bg-[#141414] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-sm font-semibold text-violet-300">
            {profile?.full_name?.[0]?.toUpperCase() ?? 'M'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-200">{profile?.full_name}</p>
            <p className="truncate text-xs text-gray-500">{profile?.email}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2.5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3">
          <CheckCircle size={16} className="shrink-0 text-green-400" />
          <p className="text-sm text-green-300">Your payout details have been saved.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-xl border border-white/6 bg-[#141414] p-5">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300"><MapPin size={14} className="text-gray-500" /> Address</label>
          <input {...register('address')} type="text" autoComplete="street-address" className={inputClass} placeholder="House no., street, city, province" />
          {errors.address && <p className="text-xs text-red-400">{errors.address.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300"><Wallet size={14} className="text-gray-500" /> Payout network / chain</label>
          <select {...register('payout_network')} className={inputClass}>
            <option value="" disabled>Select a network</option>
            {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {errors.payout_network && <p className="text-xs text-red-400">{errors.payout_network.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300"><Wallet size={14} className="text-gray-500" /> Wallet address</label>
          <input {...register('wallet_address')} type="text" autoComplete="off" spellCheck={false} className={inputClass} placeholder="Your wallet address" />
          <p className="text-xs text-gray-500">This is your default payout account for returned funds.</p>
          {errors.wallet_address && <p className="text-xs text-red-400">{errors.wallet_address.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
