import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PendingPage from './pages/PendingPage'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import MemberLayout from './layouts/MemberLayout'

// Admin pages
import AdminMembers from './pages/admin/AdminMembers'
import AdminPaymentMethods from './pages/admin/AdminPaymentMethods'
import AdminPaymentRequests from './pages/admin/AdminPaymentRequests'
import AdminWithdrawalRequests from './pages/admin/AdminWithdrawalRequests'
import AdminAnnouncements from './pages/admin/AdminAnnouncements'

// Member pages
import MemberDashboard from './pages/member/MemberDashboard'
import MemberTransactions from './pages/member/MemberTransactions'
import MemberPaymentRequest from './pages/member/MemberPaymentRequest'
import MemberWithdrawal from './pages/member/MemberWithdrawal'
import MemberAnnouncements from './pages/member/MemberAnnouncements'

const queryClient = new QueryClient()

function AppInner() {
  const { setSession, fetchProfile, loading } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else useAuthStore.setState({ loading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else useAuthStore.setState({ profile: null, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [setSession, fetchProfile])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f0f0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/pending" element={<PendingPage />} />

      {/* Admin routes */}
      <Route element={<ProtectedRoute role="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/members" replace />} />
          <Route path="members" element={<AdminMembers />} />
          <Route path="payment-methods" element={<AdminPaymentMethods />} />
          <Route path="payment-requests" element={<AdminPaymentRequests />} />
          <Route path="withdrawal-requests" element={<AdminWithdrawalRequests />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
        </Route>
      </Route>

      {/* Member routes */}
      <Route element={<ProtectedRoute role="member" />}>
        <Route path="/dashboard" element={<MemberLayout />}>
          <Route index element={<MemberDashboard />} />
          <Route path="transactions" element={<MemberTransactions />} />
          <Route path="add-funds" element={<MemberPaymentRequest />} />
          <Route path="withdraw" element={<MemberWithdrawal />} />
          <Route path="announcements" element={<MemberAnnouncements />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
