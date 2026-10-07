import StoryRow from '../components/StoryRow.jsx'
import Photo from '../components/Photo.jsx'
import Button from '../components/Button.jsx'

const steps = [
  { title: 'Add your clothes', text: 'Upload photos of your clothes or add pieces manually. StyleSense picks up details like type, colour and style.', photo: { src: '/images/phone.jpg', alt: 'A phone camera capturing a lilac shirt', ratio: '5 / 4' } },
  { title: 'Build your style profile', text: 'Share your style, the occasions you dress for, and anything you’d rather not be shown.', photo: { label: 'App screen: style preferences' } },
  { title: 'Generate outfits', text: 'Combinations built entirely from clothes already in your wardrobe.', photo: { label: 'App screen: outfit suggestions' } },
  { title: 'Wear and rate', text: 'Rate, save, wear, skip or leave feedback so the app understands what you actually reach for.', photo: { label: 'App screen: rating an outfit' } },
  { title: 'StyleSense learns', text: 'Every interaction shapes what you see next, including which pieces need a rest.', photo: { label: 'App screen: wear history' } },
]

const situations = [
  'Rainy morning? Weather-appropriate pieces move up the list.',
  'Presentation today? More formal options come first.',
  'Don’t want to repeat yesterday? Your recent outfits are taken into account.',
  'Something no longer fits? Fit feedback keeps it out of your suggestions.',
]

const signals = [
  'Clothing attributes', 'Personal style', 'Previous interactions', 'Outfit ratings', 'Feedback',
  'Wear frequency', 'Occasion', 'Weather', 'Location', 'Preferences', 'Fashion trends', 'Fit and size',
]

export default function HowItWorks() {
  return (
    <>
      <section className="feat-hero">
        <div className="wrap">
          <div className="feat-hero-inner">
            <p className="eyebrow">How it works</p>
            <h1>From closet to outfit in five steps.</h1>
            <p className="lead">
              Setting up StyleSense takes a few minutes. After that, it works quietly in the background of your mornings.
            </p>
          </div>
        </div>
      </section>

      <section className="story" aria-label="The five steps">
        <div className="wrap">
          {steps.map((s, i) => (
            <StoryRow
              key={s.title}
              num={String(i + 1).padStart(2, '0')}
              title={s.title}
              text={s.text}
              photo={s.photo}
              reverse={i % 2 === 1}
            />
          ))}
        </div>
      </section>

      <section className="hiw-context" aria-labelledby="context-title">
        <div className="wrap hiw-context-grid">
          <Photo
            className="hiw-context-image"
            src="/images/phone.jpg"
            alt="A phone camera capturing a lilac shirt hanging in a sunlit bedroom"
            ratio="4 / 5"
          />
          <div className="hiw-context-copy">
            <p className="eyebrow">Context-aware</p>
            <h2 id="context-title">Your day changes. So do the suggestions.</h2>
            <p className="lead">Recommendations aren’t made in a vacuum. StyleSense considers the situation you’re dressing for.</p>
            <ul className="hiw-situations">
              {situations.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="hiw-signals-section" aria-labelledby="signals-title">
        <div className="wrap">
          <p className="eyebrow">What it considers</p>
          <h2 id="signals-title">A lot of small signals, one simple answer.</h2>
          <ul className="hiw-signals">
            {signals.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      </section>

      <section className="hiw-closing">
        <div className="wrap">
          <div className="cta-band">
            <h2>Your closet has more stories to tell.</h2>
            <p className="lead">Discover new ways to wear what you already own with StyleSense.</p>
            <div className="hero-buttons">
              <Button variant="primary" to="/download">Get the App</Button>
              <Button variant="outline" to="/features">Explore StyleSense</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}