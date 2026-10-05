import Button from './Button.jsx'

export default function Hero() {
  return (
    <section id="top" className="hero2">
      <div className="hero2-copy">
        <p className="hero2-kicker">Wardrobe recommendation app</p>
        <h1>
          Wear what <span>you own.</span>
        </h1>
        <p className="lead">
          Better outfits from the clothes already in your closet, picked for your style, your plans and today’s weather.
        </p>
        <div className="hero-buttons">
          <Button variant="primary" to="/download">Download the App</Button>
          <Button variant="outline" to="/features">Explore StyleSense</Button>
        </div>
      </div>

      <figure className="hero2-figure">
        <div className="image-frame hero2-image">
          <img
            src="/images/closet.jpg"
            alt="A woman choosing an outfit from her wardrobe in a sunlit bedroom"
          />
        </div>
        <figcaption>
          <strong>120+</strong>
          outfits from 30 pieces
        </figcaption>
      </figure>
    </section>
  )
}