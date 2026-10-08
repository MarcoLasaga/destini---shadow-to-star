export default function Notice({ kind = 'info', children }) {
  return (
    <p className="note" data-kind={kind} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}