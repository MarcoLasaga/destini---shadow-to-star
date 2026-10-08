import { useLocation } from 'react-router-dom'
import StatusPage from '../components/StatusPage.jsx'

export default function AccountCreated() {
  const first = useLocation().state?.name?.split(' ')[0]
  return (
    <StatusPage
      kind="success"
      eyebrow="Account created"
      title={first ? `Welcome to StyleSense, ${first}.` : 'Welcome to StyleSense.'}
      text="Your account is ready. You can now continue to StyleSense."
      primary={{ label: 'Continue', to: '/download' }}
      secondary={{ label: 'Back to Home', to: '/' }}
      footnote="Preview only: accounts aren’t connected to a server yet, so nothing was stored."
    />
  )
}