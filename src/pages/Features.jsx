import StoryRow from '../components/StoryRow.jsx'
import Duo from '../components/Duo.jsx'
import Spotlight from '../components/Spotlight.jsx'
import WearLedger from '../components/WearLedger.jsx'
import Button from '../components/Button.jsx'

const hybrid = [
  ['Content-based', 'Looks at each piece: its colour, type and style, and how they pair.'],
  ['Collaborative', 'Learns from ratings by people with similar taste.'],
]

export default function Features() {
  return (
    <>
      <section className="feat-hero">
        <div className="wrap">
          <div className="feat-hero-inner">
            <p className="eyebrow">Features</p>
            <h1>Built around the clothes you already own.</h1>
            <p className="lead">
              StyleSense is a mobile-first wardrobe assistant. Here’s what it does once your closet is inside the app.
            </p>
          </div>
        </div>
      </section>

      <Duo
        label="Wardrobe features"
        items={[
          {
            eyebrow: 'Digital wardrobe',
            title: 'Your whole closet, in one place.',
            text: 'Capture or upload photos of your clothes and keep everything organised. Add or correct pieces by hand whenever you want.',
            tags: ['Photo upload', 'Camera capture', 'Categories'],
            photo: { src: '/images/phone.jpg', alt: 'A phone camera capturing a lilac shirt for the wardrobe' },
          },
          {
            eyebrow: 'Clothing recognition',
            title: 'It reads the details so you don’t have to.',
            text: 'StyleSense picks up clothing details from your photos, so there are no long forms to fill in.',
            tags: ['Type', 'Colour', 'Style'],
            photo: { src: '/images/flatlay.jpg', alt: 'A yellow sweater, lilac shirt, jeans and sneakers laid out flat' },
          },
        ]}
      />

      <Spotlight
        eyebrow="Outfit generator"
        title="Outfits built only from what you own."
        text="Mix and match combinations using only the clothing already in your wardrobe."
        phone={{ label: 'App screen: generated outfit' }}
      />

      <section className="feat-list-section" aria-labelledby="hybrid-title">
        <div className="wrap">
          <p className="eyebrow">Hybrid recommendations</p>
          <h2 id="hybrid-title" className="details-title">Two ways of thinking, one outfit.</h2>
          <ul className="feat-rows">
            {hybrid.map(([title, text]) => (
              <li key={title} className="feat-row">
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="story">
        <div className="wrap">
          <StoryRow
            eyebrow="Weather-aware styling"
            title="Dressed for the day ahead."
            text="Recommendations can take current weather, your location and the occasion into account."
            photo={{ src: '/images/closet.jpg', alt: 'A woman choosing an outfit in warm morning light', ratio: '5 / 4' }}
          />
        </div>
      </section>

      <Spotlight
        reverse
        tone="plain"
        eyebrow="Outfit planner"
        title="Plan the week before it starts."
        text="Save outfits and plan what you’ll wear for the days ahead."
        phone={{ label: 'App screen: weekly planner' }}
      />

      <WearLedger />

      <section className="pull">
        <div className="wrap pull-grid">
          <div>
            <p className="eyebrow">No New Clothes mode</p>
            <p className="pull-text">Wear more. <span>Buy less.</span></p>
          </div>
          <p className="lead">Prioritises clothing you already own instead of nudging you toward new purchases.</p>
        </div>
      </section>

      <section className="story">
        <div className="wrap">
          <StoryRow
            reverse
            eyebrow="Community"
            title="See how others style theirs."
            text="Browse and react to outfits shared by other members. These interactions feed back into the recommendations."
            photo={{ src: '/images/friends.jpg', alt: 'Three friends in knitwear and scarves laughing on a street', ratio: '5 / 4' }}
          />
          <StoryRow
            eyebrow="Size adaptability"
            title="Fits the body you have now."
            text="Your sizes and fit feedback can be updated over time, so outdated clothing details stop shaping your recommendations."
            photo={{ label: 'App screen: size and fit' }}
          />
        </div>
      </section>

      <section className="about-closing">
        <div className="wrap">
          <div className="cta-band">
            <h2>Your closet has more stories to tell.</h2>
            <p className="lead">Discover new ways to wear what you already own with StyleSense.</p>
            <div className="hero-buttons">
              <Button variant="primary" to="/download">Get the App</Button>
              <Button variant="outline" to="/how-it-works">See how it works</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}