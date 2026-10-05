import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage.jsx'

const sections = [
  {
    title: 'Acceptance of Terms',
    body: 'By creating an account or using StyleSense, you agree to be bound by these Terms of Service.',
  },
  {
    title: 'User Responsibilities',
    body: 'You are responsible for maintaining the accuracy of the information you provide and for any content you upload, including wardrobe images and profile details.',
  },
  {
    title: 'Account Usage',
    body: 'You must be at least 13 years of age to use StyleSense. You are responsible for maintaining the confidentiality of your account credentials.',
  },
  {
    title: 'Wardrobe Content',
    body: 'You retain ownership of any images and content you upload. By uploading content, you grant StyleSense a limited license to use it solely for the purpose of providing the app’s features to you.',
  },
  {
    title: 'Intellectual Property',
    body: 'The StyleSense application, including its design, logos, and underlying technology, is the property of StyleSense and its licensors and may not be copied or reproduced without permission.',
  },
  {
    title: 'Service Availability',
    body: 'We strive to keep StyleSense available at all times but do not guarantee uninterrupted access. Features may be modified, suspended, or discontinued at our discretion.',
  },
  {
    title: 'Privacy',
    body: (
      <>
        Your use of StyleSense is also governed by our{' '}
        <Link to="/privacy-policy">Privacy Policy</Link>, which describes how we collect and use your information.
      </>
    ),
  },
  {
    title: 'Limitation of Liability',
    body: 'StyleSense is provided “as is” without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the application.',
  },
  {
    title: 'Termination',
    body: 'We reserve the right to suspend or terminate accounts that violate these Terms of Service.',
  },
  {
    title: 'Governing Law',
    body: 'These Terms are governed by the laws of the applicable jurisdiction in which StyleSense operates, without regard to conflict of law principles.',
  },
]

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="Last updated: July 2026"
      sections={sections}
      prefix="terms"
      other={{ label: 'Privacy Policy', to: '/privacy-policy' }}
    />
  )
}