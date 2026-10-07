export default function WearLedger() {
  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="wrap ledger-grid">
        <div>
          <p className="eyebrow">Wear frequency</p>
          <h2 id="ledger-title">Worn it a lot? StyleSense makes room for something different.</h2>
        </div>
        <div>
          <dl className="ledger-rows">
            <div><dt>Piece</dt><dd>Black oversized tee</dd></div>
            <div><dt>Worn</dt><dd className="big">8 times</dd></div>
            <div><dt>Last worn</dt><dd>3 days ago</dd></div>
            <div><dt>StyleSense</dt><dd>Suggests it less, for now</dd></div>
          </dl>
          <p className="ledger-note">An example of how wear tracking works in the app.</p>
        </div>
      </div>
    </section>
  )
}