import StoryRow from '../components/StoryRow.jsx'
import Button from '../components/Button.jsx'

export default function About() {
  return (
    <>
      <section className="feat-hero">
        <div className="wrap">
          <div className="feat-hero-inner">
            <p className="eyebrow">About</p>
            <h1>A wardrobe assistant, not a shopping app.</h1>
            <p className="lead">
              StyleSense started from a simple observation: people own plenty of clothes and still feel stuck every morning.
            </p>
          </div>
        </div>
      </section>

      <section className="pull">
        <div className="wrap">
          <p className="pull-text">
            A full closet and <span>nothing to wear</span> is a design problem, not a shopping problem.
          </p>
        </div>
      </section>

      <section className="story">
        <div className="wrap">
          <StoryRow
            eyebrow="Wardrobe fatigue"
            title="You don’t need more. You need better combinations."
            text="Most closets hold dozens of outfits nobody has tried. StyleSense finds them, so mornings take less thinking."
            photo={{ label: 'Photo: a full closet' }}
          />
          <StoryRow
            reverse
            eyebrow="Buying less"
            title="Made for people who shop carefully."
            text="StyleSense was developed to help users maximise their existing wardrobe rather than encourage more buying."
            photo={{ label: 'Photo: thrifted and hand-me-down pieces' }}
          />
          <StoryRow
            eyebrow="Who it’s for"
            title="Students, young professionals, and anyone shopping carefully."
            text="If your closet is a mix of hand-me-downs, thrifted finds and a few favourites, StyleSense is built for exactly that."
            photo={{ src: '/images/friends.jpg', alt: 'Three friends in knitwear and scarves laughing on a tree-lined street' }}
          />
        </div>
      </section>

      <section className="about-project" aria-labelledby="project-title">
        <div className="wrap about-project-grid">
          <div className="about-project-head">
            <p className="eyebrow">The project</p>
            <h2 id="project-title">An image-based wardrobe and outfit recommendation system.</h2>
            <p className="lead">StyleSense was developed to help users maximise their existing wardrobe rather than encourage more buying.</p>
          </div>
          <div className="about-project-body">
            <p>The system recognises clothing from photos, organises it into a digital wardrobe, and generates outfit recommendations using a hybrid approach: the characteristics of your clothes, your own interactions, and patterns among people with similar taste.</p>
            <p>On top of that sit the practical parts: an outfit planner, context-aware suggestions that account for weather and occasion, wear tracking so your week doesn’t repeat, and fit information that can be updated as your wardrobe and sizes change.</p>
            <p>StyleSense is an academic research project. Content on this site that hasn’t been validated yet is clearly marked as a placeholder.</p>
            <Button variant="outline" to="/how-it-works">Learn about this project</Button>
          </div>
        </div>
      </section>

      <section className="about-closing">
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