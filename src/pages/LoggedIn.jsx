import StatusPage from '../components/StatusPage.jsx'

export default function LoggedIn() {
  return (
    <StatusPage
      kind="success"
      eyebrow="Welcome back"
      title="You’re signed in to StyleSense."
      text="Your wardrobe and daily outfits live in the mobile app. Pick up where you left off."
      primary={{ label: 'Continue to StyleSense', to: '/download' }}
      secondary={{ label: 'Back to Home', to: '/' }}
      footnote="Preview only: sign-in isn’t connected to a server yet, so nothing was checked."
    />
  )
}