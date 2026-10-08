import { useLocation } from 'react-router-dom'
import StatusPage from '../components/StatusPage.jsx'

export default function AccountFailed() {
  const reason = useLocation().state?.reason
  return (
    <StatusPage
      kind="error"
      eyebrow="Account creation failed"
      title="We couldn’t complete your account setup."
      text="Please check your information and try again."
      detail={reason}
      primary={{ label: 'Try Again', to: '/signup' }}
      secondary={{ label: 'Back to Sign Up', to: '/signup' }}
    />
  )
}