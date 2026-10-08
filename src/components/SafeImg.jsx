import { useState } from 'react'

export default function SafeImg({ src, alt = '', label, ...rest }) {
  const [bad, setBad] = useState(false)
  if (bad) {
    return (
      <div className="photo-ph" role="img" aria-label={alt || label || 'Image'}>
        {label || 'Photo'}
      </div>
    )
  }
  return <img src={src} alt={alt} onError={() => setBad(true)} {...rest} />
}