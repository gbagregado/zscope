import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { ShieldAlert } from 'lucide-react'

// One-time investment awareness / risk agreement. Blocks the member UI
// until accepted; acceptance is stored on the profile (terms_accepted_at)
// so it shows only once ever per member.
export default function TermsGate() {
  const { profile, session, fetchProfile } = useAuthStore()
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')

  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('accept_terms')
      if (error) throw error
    },
    onSuccess: async () => {
      if (session?.user.id) await fetchProfile(session.user.id)
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save. Please try again.'),
  })

  // Only members who haven't accepted yet are gated. Admins are exempt.
  if (!profile || profile.role === 'admin' || profile.terms_accepted_at) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            <ShieldAlert size={20} />
          </div>
          <h2 className="text-base font-semibold text-white">Important Awareness Notice</h2>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-300">
          <p>
            This is a private copy trading and investment service involving cryptocurrency and other
            investment opportunities.
          </p>

          <p className="font-medium text-gray-100">Please invest responsibly.</p>
          <ul className="list-disc space-y-1.5 pl-5 text-gray-400">
            <li>Only invest money you can afford to lose.</li>
            <li>Cryptocurrency markets are highly volatile, and profits are not guaranteed.</li>
            <li>Past performance does not guarantee future results.</li>
            <li>
              Before investing, carefully read the description of each investment option in the
              Investment Center to understand its risks, terms, and strategy.
            </li>
          </ul>

          <div>
            <p className="font-medium text-gray-100">Investment Choices</p>
            <p className="mt-1 text-gray-400">Depending on the option you select, your funds may be used for:</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-gray-400">
              <li>Copying our cryptocurrency trading strategies.</li>
              <li>Participating in our investments through selected third-party applications and platforms.</li>
            </ul>
          </div>

          <p className="text-gray-400">
            By proceeding, you acknowledge that you understand the risks associated with investing and
            accept full responsibility for your investment decisions.
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-[#0f0f0f] p-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => { setAgreed(e.target.checked); setError('') }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
            />
            <span className="text-[13px] text-gray-300">
              I have read, understood, and agree to the terms and risks stated above. I acknowledge that
              I am investing at my own risk and that I am only investing money I can afford to lose.
            </span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <button
            onClick={() => { if (!agreed) { setError('Please check the box to continue.'); return } accept.mutate() }}
            disabled={!agreed || accept.isPending}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {accept.isPending ? 'Saving…' : 'I Agree & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
