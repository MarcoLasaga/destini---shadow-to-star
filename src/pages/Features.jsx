import StoryRow from '../components/StoryRow.jsx'
import Button from '../components/Button.jsx'

const major = [
  {
    eyebrow: '01 · Digital wardrobe',
    title: 'Your whole closet, in one place.',
    text: 'Capture or upload photos of your clothes and keep everything organised.',
    tags: ['Photo upload', 'Camera capture', 'Categories'],
    photo: { label: 'App screen: wardrobe' },
  },
  {
    eyebrow: '02 · Smart clothing recognition',
    title: 'It reads the details so you don’t have to.',
    text: 'StyleSense picks up clothing details from your photos, so there are no long forms to fill in.',
    tags: ['Type', 'Colour', 'Style'],
    photo: { label: 'Photo: clothing detection' },
  },
  {
    eyebrow: '03 · Mix & match generator',
    title: 'Outfits built only from what you own.',
    text: 'Build outfit combinations using only the clothing already in your wardrobe.',
    photo: { label: 'App screen: generated outfit' },
  },
  {
    eyebrow: '04 · Personalized recommendations',
    title: 'Suggestions that learn your taste.',
    text: 'Suggestions adapt to your preferences, ratings, feedback and the outfits you actually engage with.',
    tags: ['Preferences', 'Ratings', 'Feedback', 'History'],
    photo: { label: 'App screen: recommendations' },
  },
  {
    eyebrow: '05 · Weather-aware outfits',
    title: 'Dressed for the day ahead.',
    text: 'Recommendations can take current weather and your location into account.',
    photo: { label: 'App screen: weather-aware pick' },
  },
  {
    eyebrow: '06 · Outfit planner',
    title: 'Plan the week before it starts.',
    text: 'Save outfits and plan what you’ll wear for the days ahead.',
    tags: ['Daily picks', 'Weekly plan'],
    photo: { label: 'App screen: weekly planner' },
  },
]

const details = [
  ['Manual wardrobe input', 'Add or correct pieces by hand whenever recognition needs a little help.'],
  ['Occasion-based styling', 'Ask for something that suits school, work, a formal event, a casual day or an occasion you define yourself.'],
  ['No New Clothes mode', 'Prioritises clothing you already own instead of nudging you toward new purchases.'],
  ['Wear frequency tracking', 'Tracks how often pieces and outfits are worn, then eases the overused ones out of your suggestions.'],
  ['Size adaptability', 'Your sizes and fit feedback can be updated over time, so outdated clothing details stop shaping your recommendations.'],
  ['Community & outfit discovery', 'Browse and react to outfits shared by other members. These interactions feed back into the recommendations.'],
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

      <section className="story">
        <div className="wrap">
          {major.map((f, i) => (
            <StoryRow key={f.title} {...f} reverse={i % 2 === 1} />
          ))}
        </div>
      </section>

      <section className="feat-list-section" aria-labelledby="details-title">
        <div className="wrap">
          <h2 id="details-title" className="details-title">And the details</h2>
          <ul className="feat-rows">
            {details.map(([title, text], i) => (
              <li key={title} className="feat-row feat-row-n">
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="feat-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')} /</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="pricing" aria-labelledby="pricing-title">
        <div className="wrap">
          <div className="pricing-copy">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-title">Free to start. Plus is coming soon.</h2>
            <p className="lead">
              StyleSense is free for the core wardrobe and recommendation features. A StyleSense Plus tier is planned for future premium features, and pricing hasn’t been finalised yet.
            </p>
          </div>

          <div className="plans">
            <div className="plan plan-free">
              <p className="eyebrow">Free</p>
              <h3>Everyday StyleSense</h3>
              <p>Digital wardrobe, outfit generation, recommendations and planning.</p>
            </div>
            <div className="plan plan-soon">
              <p className="eyebrow">Coming soon</p>
              <h3>StyleSense Plus</h3>
              <p>For future premium features. No pricing announced yet.</p>
            </div>
          </div>

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