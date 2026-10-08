export default function WearLedger() {
  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="wrap ledger-grid">
        <div>
          <p className="eyebrow">Wear frequency</p>
          <h2 id="ledger-title">Worn it a lot? StyleSense makes room for something different.</h2>
        </div>
        <div>
          <div className="ledger-item">
            <p className="ledger-piece">Black oversized tee</p>
            <p className="ledger-meta">
              <span><b>Worn</b>8 times</span>
              <span><b>Last worn</b>3 days ago</span>
            </p>
            <p className="ledger-result">StyleSense suggests it less, for now.</p>
          </div>
          <p className="ledger-note">An example of how wear tracking works in the app.</p>
        </div>
      </div>
    </section>
  )
}