import SafeImg from './SafeImg.jsx'

export default function Photo({ src, alt = '', label, ratio = '5 / 4', className = '' }) {
  return (
    <div className={`image-frame photo ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {src ? (
        <SafeImg src={src} alt={alt} label={label} loading="lazy" />
      ) : (
        <div className="photo-ph" role="img" aria-label={label || 'Image placeholder'}>
          {label || 'Photo'}
        </div>
      )}
    </div>
  )
}