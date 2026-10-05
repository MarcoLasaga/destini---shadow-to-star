import { Link } from 'react-router-dom'
import Hero from '../components/Hero.jsx'
import Section from '../components/Section.jsx'
import ImageGrid from '../components/ImageGrid.jsx'
import StoryRow from '../components/StoryRow.jsx'
import Button from '../components/Button.jsx'

const outfits = [
  { title: 'School', text: 'Comfortable, practical looks for long days.', image: '/images/flatlay.jpg', alt: 'A yellow sweater, lilac shirt, jeans and white sneakers laid out flat' },
  { title: 'Work', text: 'Polished combinations from pieces you own.', image: '/images/phone.jpg', alt: 'A phone photographing a lilac shirt hanging in a bedroom' },
  { title: 'Casual', text: 'Easy everyday outfits without the guesswork.', image: '/images/friends.jpg', alt: 'Three friends laughing together in scarves on a city street' },
  { title: 'Events & weather', text: 'Dressed for the occasion and the forecast.', image: '/images/closet.jpg', alt: 'A woman browsing her wardrobe in warm morning light' },
]

const steps = [
  ['Build your wardrobe', 'Upload photos of your clothes or add them manually.'],
  ['Tell us about you', 'Style, occasions, comfort and sizing preferences.'],
  ['Get outfits', 'StyleSense matches your wardrobe to your day.'],
  ['Wear, rate, improve', 'Your feedback makes the next picks better.'],
]

export default function Home() {
  return (
    <>
      <Hero />

      <div className="wrap">
        <Section id="outfits" title="Outfits that fit your day" linkText="All features" linkHref="/features">
          <ImageGrid items={outfits} />
        </Section>
      </div>

      <section className="story">
        <div className="wrap">
          <StoryRow
            eyebrow="Your closet, digitised"
            title="Snap it once. It’s in your wardrobe."
            text="Photograph a piece and StyleSense reads its type, colour and style, so building your wardrobe takes minutes."
            photo={{ src: '/images/phone.jpg', alt: 'A phone camera capturing a lilac shirt for the wardrobe', ratio: '5 / 4' }}
          />
          <StoryRow
            reverse
            eyebrow="Built around your day"
            title="Rain, school, a presentation. It knows."
            text="Weather, location and occasion shape what comes first, so the suggestion fits the day you’re actually having."
            photo={{ label: 'App screen: today’s outfit and weather' }}
          />
        </div>
      </section>

      <div className="wrap">
        <Section id="how-it-works" title="How StyleSense works" linkText="Full walkthrough" linkHref="/how-it-works">
          <ol className="steps">
            {steps.map(([title, text], i) => (
              <li key={title}>
                <span className="num muted-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <section className="home-project" aria-labelledby="home-project-title">
        <div className="wrap home-project-grid">
          <div>
            <p className="eyebrow">The project</p>
            <h2 id="home-project-title">Built to help you buy less.</h2>
          </div>
          <div>
            <p className="lead">
              StyleSense is an academic research project: an image-based wardrobe and outfit recommendation system that helps people make more of the clothes they already own.
            </p>
            <Link className="text-link" to="/about">Read the story <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="cta">
          <div className="phone-frame">
            <img src="/images/phone.jpg" alt="A phone camera capturing a lilac shirt for the StyleSense wardrobe" loading="lazy" />
          </div>
          <div className="cta-copy">
            <h2>Your wardrobe is already waiting.</h2>
            <p className="lead">Take StyleSense with you and get personalized outfit recommendations wherever you go.</p>
            <div className="hero-buttons">
              <Button variant="primary" to="/download">Get the App</Button>
              <Button variant="outline" to="/features">Explore StyleSense</Button>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}