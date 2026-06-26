import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useState } from 'react'
import { AlertCircle, ShieldCheck, BarChart3, Wallet, Eye, EyeOff } from 'lucide-react'
import logo from '../assets/logo.jpeg'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError('')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (authError) { setError(authError.message); return }
    if (!authData.user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (!profile) return
    await fetchProfile(authData.user.id)

    if (profile.status === 'pending') { navigate('/pending'); return }
    navigate(profile.role === 'admin' ? '/admin' : '/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Left brand panel — desktop only */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-700 via-violet-800 to-indigo-950 p-12 lg:flex">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <img src={logo} alt="Z-Scope" className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/20" />
          <span className="text-xl font-bold tracking-tight text-white">Z-Scope</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Monitor your cash flow with clarity.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-violet-200/80">
            Real-time balance tracking, secure fund requests, and complete transaction transparency — all in one place.
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
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logo} alt="Z-Scope" className="h-12 w-12 rounded-xl object-cover shadow-lg shadow-black/40" />
            <span className="text-xl font-bold tracking-tight text-white">Z-Scope</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-gray-400">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Email address</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-gray-100 placeholder-gray-400 outline-none transition focus:border-violet-500 focus:bg-white/[0.05] focus:ring-4 focus:ring-violet-500/10"
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 pr-11 text-sm text-gray-100 placeholder-gray-400 outline-none transition focus:border-violet-500 focus:bg-white/[0.05] focus:ring-4 focus:ring-violet-500/10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl bg-violet-600 py-5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-violet-400 transition-colors hover:text-violet-300">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
