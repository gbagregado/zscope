import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { X, Megaphone } from 'lucide-react'

type PopupAnnouncement = {
  id: string
  title: string
  body: string
  image_url: string | null
}

// Shows the latest announcement flagged as a login pop-up, once per
// login session (tracked per-announcement in sessionStorage so a new
// pop-up announcement will show again even within the same session).
export default function LoginPopup() {
  const { profile } = useAuthStore()
  const [dismissed, setDismissed] = useState(false)

  const { data: announcement } = useQuery({
    queryKey: ['login-popup'],
    enabled: !!profile?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PopupAnnouncement | null> => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, body, image_url')
        .eq('show_as_popup', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const seenKey = announcement ? `zscope-popup-seen:${announcement.id}` : null

  useEffect(() => {
    if (seenKey && sessionStorage.getItem(seenKey)) setDismissed(true)
  }, [seenKey])

  function close() {
    if (seenKey) sessionStorage.setItem(seenKey, '1')
    setDismissed(true)
  }

  if (!announcement || dismissed) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} aria-hidden />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-800 bg-[#141414] shadow-2xl">
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-gray-300 hover:bg-black/60 hover:text-white transition"
        >
          <X size={16} />
        </button>

        {announcement.image_url && (
          <img src={announcement.image_url} alt={announcement.title} className="max-h-60 w-full object-cover" />
        )}

        <div className="p-5">
          <div className="flex items-center gap-2 text-violet-400">
            <Megaphone size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Announcement</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-gray-100">{announcement.title}</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-400">{announcement.body}</p>
          <button
            onClick={close}
            className="mt-5 w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
