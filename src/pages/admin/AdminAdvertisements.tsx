import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useConfirm } from '../../components/ConfirmDialog'
import { Upload, Trash2, ToggleLeft, ToggleRight, ArrowUp, ArrowDown, ImageIcon, Monitor } from 'lucide-react'
import type { Database } from '../../lib/database.types'

type Ad = Database['public']['Tables']['advertisements']['Row']

export default function AdminAdvertisements() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const confirm = useConfirm()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const { data: ads, isLoading } = useQuery({
    queryKey: ['advertisements-admin'],
    queryFn: async (): Promise<Ad[]> => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('advertisements').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advertisements-admin'] }),
  })

  const togglePopup = useMutation({
    mutationFn: async ({ id, show_as_popup }: { id: string; show_as_popup: boolean }) => {
      const { error } = await supabase.from('advertisements').update({ show_as_popup }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advertisements-admin'] }),
  })

  const reorder = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase.from('advertisements').update({ sort_order: u.sort_order }).eq('id', u.id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advertisements-admin'] }),
  })

  const del = useMutation({
    mutationFn: async (ad: Ad) => {
      if (ad.storage_path) {
        await supabase.storage.from('advertisements').remove([ad.storage_path])
      }
      const { error } = await supabase.from('advertisements').delete().eq('id', ad.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advertisements-admin'] }),
  })

  async function handleUpload() {
    if (!file) return
    setError('')
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('advertisements').upload(path, file)
    if (upErr) {
      setUploading(false)
      setError(`Upload failed: ${upErr.message}. Make sure the advertisements storage policies are applied.`)
      return
    }
    const { data: urlData } = supabase.storage.from('advertisements').getPublicUrl(path)
    const nextOrder = (ads?.length ?? 0)
    const { error: insErr } = await supabase.from('advertisements').insert({
      image_url: urlData.publicUrl,
      storage_path: path,
      sort_order: nextOrder,
      created_by: profile!.id,
    })
    setUploading(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setFile(null)
    qc.invalidateQueries({ queryKey: ['advertisements-admin'] })
  }

  function move(index: number, dir: -1 | 1) {
    if (!ads) return
    const target = index + dir
    if (target < 0 || target >= ads.length) return
    const a = ads[index]
    const b = ads[target]
    reorder.mutate([
      { id: a.id, sort_order: target },
      { id: b.id, sort_order: index },
    ])
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Advertisements</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload banner images that rotate on the member dashboard. Drag order with the arrows; hide any banner without deleting it. Use the monitor icon to show a banner as a login pop-up.
        </p>
      </div>

      {/* Upload box */}
      <div className="space-y-3 rounded-xl border border-gray-800 bg-[#141414] p-4">
        <h2 className="text-sm font-medium text-gray-300">Add Banner</h2>
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
        )}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-700 bg-[#0f0f0f] p-3 transition hover:border-violet-500/60 hover:bg-violet-500/5">
          {file ? (
            <img src={URL.createObjectURL(file)} alt="preview" className="h-16 w-28 rounded-lg border border-gray-700 object-cover" />
          ) : (
            <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-gray-700 bg-[#141414] text-gray-600">
              <ImageIcon size={24} />
            </div>
          )}
          <div className="flex flex-1 items-center gap-2 text-sm text-gray-400">
            <Upload size={15} />
            <span>{file ? file.name : 'Click to choose a banner image'}</span>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-600">Recommended: wide image (e.g. 1200×500). PNG or JPG.</p>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading…' : 'Add Banner'}
        </button>
      </div>

      {/* Existing ads */}
      <div className="space-y-3">
        {ads?.length === 0 && <p className="text-sm text-gray-600">No banners yet. Upload one above.</p>}
        {ads?.map((ad, i) => (
          <div key={ad.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#141414] p-3">
            <img src={ad.image_url} alt="banner" className="h-16 w-28 shrink-0 rounded-lg border border-gray-700 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-300">Banner #{i + 1}</p>
              <p className="text-xs text-gray-600">
                {ad.is_active ? 'Visible to members' : 'Hidden'}
                {ad.show_as_popup && <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">Login pop-up</span>}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => togglePopup.mutate({ id: ad.id, show_as_popup: !ad.show_as_popup })}
                className={ad.show_as_popup ? 'rounded-md p-1.5 text-violet-400 hover:bg-white/5' : 'rounded-md p-1.5 text-gray-600 hover:bg-white/5 hover:text-gray-300'}
                title={ad.show_as_popup ? 'Stop showing as login pop-up' : 'Show as login pop-up'}
              >
                <Monitor size={16} />
              </button>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-md p-1.5 text-gray-500 hover:bg-white/5 hover:text-gray-300 disabled:opacity-30"
                title="Move up"
              >
                <ArrowUp size={16} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === (ads?.length ?? 0) - 1}
                className="rounded-md p-1.5 text-gray-500 hover:bg-white/5 hover:text-gray-300 disabled:opacity-30"
                title="Move down"
              >
                <ArrowDown size={16} />
              </button>
              <button
                onClick={() => toggle.mutate({ id: ad.id, is_active: !ad.is_active })}
                className={ad.is_active ? 'text-green-400' : 'text-gray-600'}
                title={ad.is_active ? 'Hide' : 'Show'}
              >
                {ad.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete banner?',
                    message: 'This advertisement image will be permanently removed.',
                    confirmText: 'Delete',
                    tone: 'danger',
                  })
                  if (ok) del.mutate(ad)
                }}
                className="text-gray-600 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
