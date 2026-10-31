import worker from '../dev-worker'

// Control database scheduling in this test Worker while retaining the real
// HTTP handlers, reducer, SQL authority predicate and atomic D1 transaction.
export default {
 async fetch(request: Request, env: any, execution: ExecutionContext) {
  if (!request.headers.has('x-synthetic-mallet-pause-write')) return worker.fetch(request, env, execution)
  const originals = new WeakMap<object, any>(), queries = new WeakMap<object, string>()
  const wrap = (statement: any, sql: string): any => {
   const proxy = new Proxy(statement, {get(target, key) {
    if (key === 'bind') return (...values: any[]) => wrap(target.bind(...values), sql)
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
   }})
   originals.set(proxy, statement); queries.set(proxy, sql)
   return proxy
  }
  const DB = {
   prepare: (sql: string) => wrap(env.DB.prepare(sql), sql),
   async batch(statements: any[]) {
    if (statements.some(statement => queries.get(statement)?.includes('CASE WHEN version=?'))) {
     await fetch('https://synthetic-mallet.invalid/preparation-write')
    }
    return env.DB.batch(statements.map(statement => originals.get(statement) ?? statement))
   }
  }
  return worker.fetch(request, {...env, DB}, execution)
 }
}
