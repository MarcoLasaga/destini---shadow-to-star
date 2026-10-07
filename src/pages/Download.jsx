import Button from '../components/Button.jsx'
import PhoneMock from '../components/PhoneMock.jsx'
import Spotlight from '../components/Spotlight.jsx'

const steps = [
  'Install StyleSense on your phone.',
  'Add a handful of pieces from your closet.',
  'Tell it your style and usual occasions.',
  'Get your first recommendations and start rating them.',
]

const reasons = [
  ['Built for the closet', 'A mobile-first app, made for the moment you’re standing in front of your wardrobe.'],
  ['Photographed once', 'Snap a piece and it joins your digital wardrobe with its details filled in.'],
  ['Fits the day', 'Weather, location and occasion shape every suggestion.'],
  ['Wear more, buy less', 'Everything is built from clothes you already own.'],
]

export default function Download() {
  return (
    <>
      <section className="feat-hero dl-hero">
        <div className="wrap dl-hero-grid">
          <div>
            <p className="eyebrow">Get the app</p>
            <h1>Your style doesn’t stay on the website.</h1>
            <p className="lead">
              StyleSense is a mobile-first experience for the moment you’re standing in front of your closet.
            </p>
            {/* Swap each Button for <Button variant="..." href="REAL_STORE_URL"> when the listings are live. */}
            <div className="hero-buttons">
              <Button variant="primary" aria-disabled="true">App Store (soon)</Button>
              <Button variant="outline" aria-disabled="true">Google Play (soon)</Button>
            </div>
            <p className="dl-platform">Supported platforms will be announced with the store listings.</p>
          </div>
          <div className="dl-hero-phone">
            <PhoneMock className="phone-lg" label="App screen: today’s outfit" />
          </div>
        </div>
      </section>

      <Spotlight
        tone="plain"
        eyebrow="Your wardrobe"
        title="Every piece, one tap away."
        text="Browse your closet the way you’d browse a shop, except everything is already yours."
        phone={{ label: 'App screen: wardrobe' }}
      />
      <Spotlight
        reverse
        eyebrow="Your week"
        title="Know what you’re wearing before you wake up."
        text="Plan outfits for the days ahead and let the forecast do some of the thinking."
        phone={{ label: 'App screen: planner' }}
      />

      <section className="feat-list-section" aria-labelledby="why-title">
        <div className="wrap">
          <h2 id="why-title" className="details-title">Why download</h2>
          <ul className="feat-rows">
            {reasons.map(([title, text]) => (
              <li key={title} className="feat-row">
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="dl-onboard" aria-labelledby="onboarding-title">
        <div className="wrap">
          <p className="eyebrow">Onboarding</p>
          <h2 id="onboarding-title">Five minutes to your first outfits.</h2>
          <div className="dl-grid">
            <div className="dl-copy">
              <ol className="dl-steps">
                {steps.map((text, i) => (
                  <li key={text} className="dl-step">
                    <span className="dl-num">{String(i + 1).padStart(2, '0')}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
              <div className="dl-qr">
                <div className="dl-qr-slot" role="img" aria-label="QR code placeholder">QR code</div>
                <p>Scan to install once the app listings are live.</p>
              </div>
            </div>
            <div className="image-frame dl-image">
              <img src="/images/closet.jpg" alt="A woman choosing an outfit from her wardrobe in a sunlit bedroom" loading="lazy" />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}