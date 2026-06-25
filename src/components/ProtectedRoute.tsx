import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Props {
  role: 'admin' | 'member'
}

export default function ProtectedRoute({ role }: Props) {
  const { session, profile } = useAuthStore()

  if (!session) return <Navigate to="/login" replace />
  if (!profile) return null

  if (profile.status === 'pending') return <Navigate to="/pending" replace />
  if (profile.status === 'rejected') return <Navigate to="/login" replace />

  if (profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return <Outlet />
}
