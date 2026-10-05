export default function ImageGrid({ items }) {
  return (
    <ul className="image-grid">
      {items.map((item) => (
        <li key={item.title}>
          <a href="#how-it-works" className="image-tile">
            <div className="image-frame">
              <img src={item.image} alt={item.alt} loading="lazy" />
            </div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <span className="text-link small">
              See how <span aria-hidden="true">→</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}