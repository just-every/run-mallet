/** The page's actions: Run Mallet (the Run page), the hosted demo and Read the docs. */
export function RunActions() {
  return (
    <div className="actions">
      <a className="btn" href="/run">Run Mallet <span aria-hidden="true">→</span></a>
      <a className="btn" href="https://demo.run-mallet.com/">Try the demo</a>
      <a className="text-link" href="/docs">Read the docs</a>
    </div>
  )
}
