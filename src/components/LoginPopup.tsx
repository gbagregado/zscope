import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { X, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react'

type PopupAnnouncement = {
  id: string
  title: string
  body: string
  image_url: string | null
}

type PopupAd = {
  id: string
  image_url: string
}

// Shows login pop-ups once per session: the latest flagged advertisement
// first, then the latest flagged announcement after it's dismissed.
// Each is tracked separately in sessionStorage (keyed by id) so a newly
// flagged item shows again even within the same session.
export default function LoginPopup() {
  const { profile } = useAuthStore()
  const [adDismissed, setAdDismissed] = useState(false)
  const [annDismissed, setAnnDismissed] = useState(false)

  const { data: ads } = useQuery({
    queryKey: ['login-popup-ad'],
    enabled: !!profile?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PopupAd[]> => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('id, image_url')
        .eq('show_as_popup', true)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

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

  const adKey = ads && ads.length ? `zscope-popup-seen:ad:${ads.map((a) => a.id).join(',')}` : null
  const annKey = announcement ? `zscope-popup-seen:${announcement.id}` : null

  const [slide, setSlide] = useState(0)

  useEffect(() => {
    if (adKey && sessionStorage.getItem(adKey)) setAdDismissed(true)
  }, [adKey])
  useEffect(() => {
    if (annKey && sessionStorage.getItem(annKey)) setAnnDismissed(true)
  }, [annKey])

  function closeAd() {
    if (adKey) sessionStorage.setItem(adKey, '1')
    setAdDismissed(true)
  }
  function closeAnn() {
    if (annKey) sessionStorage.setItem(annKey, '1')
    setAnnDismissed(true)
  }

  // Ad shows first; only after it's gone do we show the announcement.
  const showAd = !!ads && ads.length > 0 && !adDismissed
  const showAnn = !showAd && !!announcement && !annDismissed

  // Auto-rotate the ad carousel every 4s while it's visible.
  useEffect(() => {
    if (!showAd || !ads || ads.length < 2) return
    const t = setInterval(() => setSlide((s) => (s + 1) % ads.length), 4000)
    return () => clearInterval(t)
  }, [showAd, ads])

  if (showAd && ads) {
    const count = ads.length
    const current = slide % count
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeAd} aria-hidden />
        <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-800 bg-[#141414] shadow-2xl">
          <button
            onClick={closeAd}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-gray-200 hover:bg-black/70 hover:text-white transition"
          >
            <X size={18} />
          </button>

          <div className="relative">
            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${current * 100}%)` }}>
              {ads.map((a) => (
                <img key={a.id} src={a.image_url} alt="Advertisement" className="w-full shrink-0 object-contain" />
              ))}
            </div>

            {count > 1 && (
              <>
                <button
                  onClick={() => setSlide((s) => (s - 1 + count) % count)}
                  aria-label="Previous"
                  className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-gray-200 hover:bg-black/70 hover:text-white transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setSlide((s) => (s + 1) % count)}
                  aria-label="Next"
                  className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-gray-200 hover:bg-black/70 hover:text-white transition"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          <div className="p-4">
            {count > 1 && (
              <div className="mb-3 flex items-center justify-center gap-1.5">
                {ads.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={i === current ? 'h-1.5 w-5 rounded-full bg-violet-500 transition-all' : 'h-1.5 w-1.5 rounded-full bg-gray-600 transition-all hover:bg-gray-500'}
                  />
                ))}
              </div>
            )}
            <button
              onClick={closeAd}
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!showAnn) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeAnn} aria-hidden />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-gray-800 bg-[#141414] shadow-2xl">
        <button
          onClick={closeAnn}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-gray-300 hover:bg-black/60 hover:text-white transition"
        >
          <X size={16} />
        </button>

        {announcement!.image_url && (
          <img src={announcement!.image_url} alt={announcement!.title} className="max-h-72 w-full object-cover" />
        )}

        <div className="p-5">
          <div className="flex items-center gap-2 text-violet-400">
            <Megaphone size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Announcement</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-gray-100">{announcement!.title}</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-400">{announcement!.body}</p>
          <button
            onClick={closeAnn}
            className="mt-5 w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
