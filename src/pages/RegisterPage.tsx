import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useState } from 'react'
import { AlertCircle, ShieldCheck, BarChart3, Wallet } from 'lucide-react'
import logo from '../assets/logo.jpeg'

const schema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  payout_network: z.string().min(1, 'Please select a network'),
  wallet_address: z.string().min(20, 'Wallet address looks too short').max(120, 'Wallet address looks too long'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type FormData = z.infer<typeof schema>

const NETWORKS = ['Solana', 'Ethereum (ERC-20)', 'BNB Smart Chain (BEP-20)', 'Polygon', 'Tron (TRC-20)', 'Bitcoin', 'Arbitrum', 'Base', 'Other']

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-gray-100 placeholder-gray-400 outline-none transition focus:border-violet-500 focus:bg-white/[0.05] focus:ring-4 focus:ring-violet-500/10"

export default function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError('')
    const { error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.full_name, payout_network: data.payout_network, wallet_address: data.wallet_address } },
    })
    if (signUpError) { setError(signUpError.message); return }
    navigate('/pending')
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Left brand panel — desktop only */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-700 via-violet-800 to-indigo-950 p-12 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex justify-center">
          <img src={logo} alt="Z-Scope Global Investment Capital" className="h-40 w-40 rounded-3xl object-cover ring-1 ring-white/20 shadow-2xl shadow-black/40" />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Join Z-Scope today.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-violet-200/80">
            Create your account to start tracking your cash flow with confidence and complete transparency.
          </p>

          <div className="mt-10 flex flex-col gap-5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <BarChart3 size={17} className="text-white" />
              </div>
              <span className="text-sm text-violet-100/90">Live balance & transaction history</span>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Wallet size={17} className="text-white" />
              </div>
              <span className="text-sm text-violet-100/90">Seamless add funds & withdrawals</span>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <ShieldCheck size={17} className="text-white" />
              </div>
              <span className="text-sm text-violet-100/90">Bank-grade security & admin approval</span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-violet-300/60">
          © {new Date().getFullYear()} Z-Scope Global Investment Capital. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <img src={logo} alt="Z-Scope Global Investment Capital" className="h-40 w-40 rounded-3xl object-cover shadow-2xl shadow-black/40" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
            <p className="mt-2 text-sm text-gray-400">Get started in just a few seconds</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Full name</label>
              <input {...register('full_name')} type="text" autoComplete="name" className={inputClass} placeholder="Juan dela Cruz" />
              {errors.full_name && <p className="text-xs text-red-400">{errors.full_name.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Email address</label>
              <input {...register('email')} type="email" autoComplete="email" className={inputClass} placeholder="you@example.com" />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Payout network / chain</label>
              <select {...register('payout_network')} defaultValue="" className={inputClass}>
                <option value="" disabled>Select a network</option>
                {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {errors.payout_network && <p className="text-xs text-red-400">{errors.payout_network.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Wallet address</label>
              <input {...register('wallet_address')} type="text" autoComplete="off" spellCheck={false} className={inputClass} placeholder="Your wallet address" />
              <p className="text-xs text-gray-500">Used as your default payout account so we always know where to send your funds.</p>
              {errors.wallet_address && <p className="text-xs text-red-400">{errors.wallet_address.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <input {...register('password')} type="password" autoComplete="new-password" className={inputClass} placeholder="At least 6 characters" />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Confirm password</label>
              <input {...register('confirm')} type="password" autoComplete="new-password" className={inputClass} placeholder="Re-enter your password" />
              {errors.confirm && <p className="text-xs text-red-400">{errors.confirm.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl bg-violet-600 py-5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-violet-400 transition-colors hover:text-violet-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
