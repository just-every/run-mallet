/** Run Mallet (the Run page), the hosted demo and the docs. `demo` is false where the desk shows only the docs link. */
export function Actions({ demo = true }: { demo?: boolean }) {
  return (
    <div className="actions">
      <a className="run-pill" href="/run">Run Mallet <span aria-hidden="true">→</span></a>
      {demo ? <a className="text-link" href="https://demo.run-mallet.com/">Try the demo</a> : null}
      <a className="text-link" href="/docs">Read the docs</a>
    </div>
  )
}
