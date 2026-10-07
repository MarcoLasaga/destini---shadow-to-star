export default function PhoneMock({ src, alt = '', label, className = '' }) {
  return (
    <div className={`phone ${className}`.trim()}>
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