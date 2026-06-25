import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Clock } from 'lucide-react'

export default function PendingPage() {
  const { signOut, profile } = useAuthStore()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 border border-yellow-500/30">
          <Clock size={32} className="text-yellow-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-100">Account Pending Approval</h1>
        <p className="text-sm text-gray-500">
          Hi <span className="text-gray-300">{profile?.full_name}</span>, your account is being reviewed by the admin.
          You'll get access once approved.
        </p>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
