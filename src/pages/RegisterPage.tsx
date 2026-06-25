import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useState } from 'react'
import { TrendingUp, User, Mail, Lock, AlertCircle } from 'lucide-react'

const schema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type FormData = z.infer<typeof schema>

const inputClass = "w-full rounded-xl border border-white/8 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-600 transition focus:border-violet-500/60 focus:bg-white/7 focus:outline-none focus:ring-2 focus:ring-violet-500/20"

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
      options: { data: { full_name: data.full_name } },
    })
    if (signUpError) { setError(signUpError.message); return }
    navigate('/pending')
  }

  return (
    <div className="relative flex min-h-full items-center justify-center bg-[#0a0a0a] px-4 py-8 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-600/30">
            <TrendingUp size={28} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">ZScope</h1>
            <p className="mt-0.5 text-sm text-gray-500">Cash Flow Monitoring System</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/4 p-6 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-5 text-base font-semibold text-white">Create your account</h2>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-3.5 py-3">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Full name</label>
              <div className="relative">
                <User size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input {...register('full_name')} type="text" autoComplete="name" className={inputClass} placeholder="Juan dela Cruz" />
              </div>
              {errors.full_name && <p className="mt-1.5 text-xs text-red-400">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Email address</label>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input {...register('email')} type="email" autoComplete="email" className={inputClass} placeholder="you@example.com" />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Password</label>
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input {...register('password')} type="password" autoComplete="new-password" className={inputClass} placeholder="••••••••" />
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">Confirm password</label>
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input {...register('confirm')} type="password" autoComplete="new-password" className={inputClass} placeholder="••••••••" />
              </div>
              {errors.confirm && <p className="mt-1.5 text-xs text-red-400">{errors.confirm.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-violet-400 hover:text-violet-300 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
