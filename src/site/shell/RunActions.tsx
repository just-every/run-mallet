/** The page's two actions: Run Mallet (the Run page) and Read the docs. */
export function RunActions() {
  return (
    <div className="actions">
      <a className="btn" href="/run">Run Mallet <span aria-hidden="true">→</span></a>
      <a className="text-link" href="/docs">Read the docs</a>
    </div>
  )
}
