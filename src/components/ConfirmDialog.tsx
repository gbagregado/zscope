import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  tone?: 'danger' | 'default'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOptions(null)
  }, [])

  useEffect(() => {
    if (!options) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, close])

  const isDanger = options?.tone === 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => close(false)}
            aria-hidden
          />
          {/* Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#16161f] shadow-2xl"
          >
            <button
              onClick={() => close(false)}
              className="absolute right-3 top-3 text-gray-500 transition hover:text-gray-300"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    isDanger ? 'bg-red-500/10 text-red-400' : 'bg-violet-500/10 text-violet-400'
                  }`}
                >
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white">{options.title}</h3>
                  {options.message && (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-400">{options.message}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => close(false)}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5"
                >
                  {options.cancelText ?? 'Cancel'}
                </button>
                <button
                  onClick={() => close(true)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98] ${
                    isDanger
                      ? 'bg-red-600 shadow-red-600/25 hover:bg-red-500'
                      : 'bg-violet-600 shadow-violet-600/25 hover:bg-violet-500'
                  }`}
                >
                  {options.confirmText ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
