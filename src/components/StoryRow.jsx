import Photo from './Photo.jsx'

export default function StoryRow({ eyebrow, num, title, text, tags, reverse = false, photo }) {
  return (
    <div className={`story-row${reverse ? ' rev' : ''}`}>
      <div className="story-copy">
        {num && <span className="story-num" aria-hidden="true">{num}</span>}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        <p className="lead">{text}</p>
        {tags && (
          <ul className="tags">
            {tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="story-media">
        <Photo {...photo} />
      </div>
    </div>
  )
}