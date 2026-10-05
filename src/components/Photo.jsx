export default function Photo({ src, alt = '', label, ratio = '5 / 4', className = '' }) {
  return (
    <div className={`image-frame photo ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <div className="photo-ph" role="img" aria-label={label || 'Image placeholder'}>
          {label || 'Photo'}
        </div>
      )}
    </div>
  )
}