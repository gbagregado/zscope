import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type Ad = Database['public']['Tables']['advertisements']['Row']

export default function AdCarousel() {
  const [index, setIndex] = useState(0)

  const { data: ads } = useQuery({
    queryKey: ['advertisements-active'],
    queryFn: async (): Promise<Ad[]> => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const count = ads?.length ?? 0

  // Auto-rotate every 5s
  useEffect(() => {
    if (count <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 5000)
    return () => clearInterval(t)
  }, [count])

  // Keep index in range if ads change
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0)
  }, [count, index])

  if (count === 0) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#141414]">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {ads!.map((ad) => (
          <img
            key={ad.id}
            src={ad.image_url}
            alt="Advertisement"
            className="aspect-[16/7] w-full shrink-0 object-cover"
          />
        ))}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {ads!.map((ad, i) => (
            <button
              key={ad.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={
                i === index
                  ? 'h-1.5 w-5 rounded-full bg-violet-400 transition-all'
                  : 'h-1.5 w-1.5 rounded-full bg-white/40 transition-all hover:bg-white/70'
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
