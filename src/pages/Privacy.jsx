import LegalPage from '../components/LegalPage.jsx'

// Section titles follow your list. Replace each `body` with the exact text
// from your Privacy Policy screenshots and delete the `notice` prop.
const pending = 'The full text of this section is being finalised.'

const sections = [
  'Data Collection',
  'User Information',
  'Wardrobe Images',
  'Location Usage',
  'Weather Services',
  'Analytics',
  'Data Security',
  'User Rights',
  'Third-Party Services',
  'Contact Information',
].map((title) => ({ title, body: pending }))

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="Last updated: July 2026"
      notice="The complete policy text is being finalised and will appear here."
      sections={sections}
      prefix="privacy"
      other={{ label: 'Terms & Conditions', to: '/terms' }}
    />
  )
}