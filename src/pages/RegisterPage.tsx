import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useState } from 'react'

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
      options: {
        data: { full_name: data.full_name },
      },
    })
    if (signUpError) { setError(signUpError.message); return }
    navigate('/pending')
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#0f0f0f] px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-violet-400">ZScope</h1>
          <p className="mt-1 text-sm text-gray-500">Cash Flow Monitoring System</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-800 bg-[#141414] p-6">
          <h2 className="text-lg font-semibold text-gray-100">Create account</h2>

          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-400">Full name</label>
            <input
              {...register('full_name')}
              type="text"
              autoComplete="name"
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              placeholder="Juan dela Cruz"
            />
            {errors.full_name && <p className="mt-1 text-xs text-red-400">{errors.full_name.message}</p>}
          </div>

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
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              placeholder="••••••••"
            />
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Confirm password</label>
            <input
              {...register('confirm')}
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-700 bg-[#0f0f0f] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              placeholder="••••••••"
            />
            {errors.confirm && <p className="mt-1 text-xs text-red-400">{errors.confirm.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already registered?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
