// Replace PageName with the actual name (e.g. Wardrobe, Discover, etc.)
export default function WardrobeGaps() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '70vh', gap: 16,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(255,213,134,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="28" height="28" fill="none" stroke="#756e9e" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="12" y1="9" x2="12" y2="15"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
        </svg>
      </div>
      <h1 style={{ fontFamily: 'Bagel Fat One, cursive', fontSize: 32, color: '#2b1f0e' }}>
        PageName
      </h1>
      <p style={{ fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 15, color: '#9c866c' }}>
        Coming soon — this page is being built.
      </p>
    </div>
  )
}