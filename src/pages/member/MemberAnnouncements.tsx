import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Megaphone } from 'lucide-react'

export default function MemberAnnouncements() {
  const { data: items, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-100">Announcements</h1>

      {items?.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-gray-600">
          <Megaphone size={32} />
          <p className="text-sm">No announcements yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-xl border border-gray-800 bg-[#141414]">
            {a.image_url && (
              <img src={a.image_url} alt={a.title} className="max-h-56 w-full object-cover" />
            )}
            <div className="p-4">
              <p className="text-sm font-medium text-gray-200">{a.title}</p>
              <p className="mt-1 text-sm text-gray-400">{a.body}</p>
              <p className="mt-2 text-xs text-gray-600">
                {new Date(a.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
