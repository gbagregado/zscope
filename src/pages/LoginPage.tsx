import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const [error, setError] = useState('')

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
    <div className="flex min-h-full items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-violet-400">ZScope</h1>
          <p className="mt-1 text-sm text-gray-500">Cash Flow Monitoring System</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-800 bg-[#141414] p-6">
          <h2 className="text-lg font-semibold text-gray-100">Sign in</h2>

          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-400">Email</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Password</label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              placeholder="••••••••"
            />
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-gray-500">
            No account?{' '}
            <Link to="/register" className="text-violet-400 hover:text-violet-300">Register</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
