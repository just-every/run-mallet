import {validateCostRates} from './validate-cost-rates.mjs'
import { PortabilityError } from '@runeditrun/rer/modules/portability/storage'
import { validateRecords } from './validate-records.mjs'
import { validateStock } from './validate-stock.mjs'
import { validateMedia } from './validate-media.mjs'
import { validateFinance } from './validate-finance.mjs'
import { prepareSearchProjection } from './prepare-search.mjs'

export const quote = name => '"' + name.replaceAll('"', '""') + '"'
export function refuse(code) { throw new PortabilityError('mallet_graph:' + code, 409) }

/** The native hook's `read` loads an entire table. Never use it here: even
 * rejection queries return only one scalar, while bytes use bounded cursors.
 * All indexes and reads concern private staging copies, never live product data.
 * Historical actor IDs are snapshots and deliberately have no identity FK. */
export async function validateStaged({ db, tables, manifest }) {
 const table = name => tables[name] ? quote(tables[name]) : null
 const rejectIf = async (code, sql, params = []) => {
  if (await db.prepare(`SELECT 1 AS invalid FROM (${sql}) LIMIT 1`).bind(...params).first()) refuse(code)
 }
 const index = async (name, suffix, columns, unique = false) => {
  if (!tables[name]) return
  try { await db.prepare(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${quote(tables[name] + '_mallet_' + suffix)} ON ${table(name)} (${columns})`).run() }
  catch(error) { if(/UNIQUE constraint failed/i.test(String(error)))refuse('duplicate_'+name);throw error }
 }
 const context = { db, tables, table, rejectIf, index }
 await validateRecords(context)
 await validateCostRates(context)
 await validateFinance(context)
 await validateStock(context)
 await validateMedia(context)
 // Native CTAS staging drops source indexes. These indexes only accelerate
 // the companion search validator; archive projection contents stay exact.
 await index('mallet_search_documents','doc','doc_id',true)
 await index('mallet_search_documents','source','kind,source_id',true)
 await index('mallet_search_grams','document','doc_id,gram',true)
 await index('mallet_search_members','account','account_id,contact_id',true)
 if(manifest)await prepareSearchProjection({db,tables,manifest})
 return true
}
