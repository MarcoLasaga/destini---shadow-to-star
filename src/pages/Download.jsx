import Button from '../components/Button.jsx'
import PhoneMock from '../components/PhoneMock.jsx'

const steps = [
  'Install StyleSense on your phone.',
  'Add a handful of pieces from your closet.',
  'Tell it your style and usual occasions.',
  'Get your first recommendations and start rating them.',
]

const reasons = [
  ['Built for the closet', 'It’s a mobile-first app, made for the moment you’re standing in front of your wardrobe.'],
  ['Your clothes, photographed once', 'Snap a piece and it joins your digital wardrobe with its details filled in.'],
  ['Outfits that fit the day', 'Weather, location and occasion shape every suggestion.'],
  ['Wear more, buy less', 'Everything is built from clothes you already own.'],
]

export default function Download() {
  return (
    <>
      <section className="feat-hero">
        <div className="wrap">
          <div className="feat-hero-inner">
            <p className="eyebrow">Get the app</p>
            <h1>Your style doesn’t stay on the website.</h1>
            <p className="lead">
              StyleSense is a mobile-first experience for the moment you’re standing in front of your closet.
            </p>
          </div>
        </div>
      </section>

      <section className="showcase" aria-label="App preview">
        <div className="wrap">
          <div className="showcase-phones">
            <PhoneMock label="App screen: wardrobe" />
            <PhoneMock label="App screen: outfit of the day" />
            <PhoneMock label="App screen: planner" />
          </div>
        </div>
      </section>

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

              {/* Store buttons are placeholders. When the listings are live,
                  swap each Button for: <Button variant="outline" href="REAL_STORE_URL">...</Button> */}
              <div className="dl-stores">
                <Button variant="primary" aria-disabled="true">App Store (soon)</Button>
                <Button variant="outline" aria-disabled="true">Google Play (soon)</Button>
              </div>
              <p className="dl-platform">Supported platforms will be announced with the store listings.</p>

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