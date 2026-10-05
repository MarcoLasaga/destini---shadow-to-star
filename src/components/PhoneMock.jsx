export default function PhoneMock({ src, alt = '', label }) {
  return (
    <div className="phone">
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <div className="phone-ph" role="img" aria-label={label || 'App screen placeholder'}>
          {label || 'App screen'}
        </div>
      )}
    </div>
  )
}