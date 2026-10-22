import { createHash } from 'node:crypto'
import { refuse } from './validate-staged.mjs'
const CHUNK_BYTES = 65536
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const rows = async statement => (await statement.all()).results ?? []
const signature = (bytes, mime) => {
 const ascii=(at,s)=>bytes.subarray(at,at+s.length).toString('ascii')===s
 if(mime==='image/png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255
 if(mime==='image/webp')return ascii(0,'RIFF')&&ascii(8,'WEBP')
 if(mime==='video/mp4')return bytes.length>=12&&ascii(4,'ftyp')
 return bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163
}

export async function validateMedia({ db, table, rejectIf, index }) {
 const records=table('mallet_records'),findings=table('mallet_media_findings'),uploads=table('mallet_media_uploads'),chunks=table('mallet_media_chunks'),clients=table('mallet_media_upload_clients'),resolutions=table('mallet_media_resolutions')
 if(!findings&&!uploads&&!chunks&&!clients&&!resolutions)return
 // Additive restores can omit old, empty media tables. Nonempty children
 // without their parent are always refused, without reading them into memory.
 for(const [child,parent] of [[findings,records],[uploads,findings],[chunks,uploads],[clients,uploads],[resolutions,findings]])if(child&&!parent)await rejectIf('media_parent',`SELECT 1 FROM ${child}`)
 if(findings&&records){
  await index('mallet_media_findings','id','id',true)
  await index('mallet_media_findings','client','job_id,client_id',true)
  await rejectIf('finding_job',`SELECT 1 FROM ${findings} f WHERE NOT EXISTS(SELECT 1 FROM ${records} r WHERE r.kind='job' AND r.id=f.job_id)`)
  await rejectIf('finding_json',`SELECT 1 FROM ${findings} WHERE NOT json_valid(actor_json) OR NOT json_valid(request_json)`)
  await rejectIf('finding_request',`SELECT 1 FROM ${findings} f WHERE json_type(request_json) IS NOT 'object' OR json_type(actor_json) IS NOT 'object' OR json_extract(request_json,'$.jobId') IS NOT job_id OR json_extract(request_json,'$.clientId') IS NOT client_id OR json_extract(request_json,'$.title') IS NOT title OR json_extract(request_json,'$.capturedAt') IS NOT captured_at`)
 }
 if(uploads&&findings){
  await index('mallet_media_uploads','id','id',true)
  await index('mallet_media_uploads','content','finding_id,variant,sha256',true)
  await rejectIf('upload_finding',`SELECT 1 FROM ${uploads} u WHERE NOT EXISTS(SELECT 1 FROM ${findings} f WHERE f.id=u.finding_id AND f.job_id=u.job_id)`)
  await rejectIf('upload_variant',`SELECT 1 FROM ${uploads} u WHERE variant NOT IN ('original','shared') OR (variant='original' AND (original_id IS NOT NULL OR annotations_json IS NOT NULL)) OR (variant='shared' AND NOT EXISTS(SELECT 1 FROM ${uploads} o WHERE o.id=u.original_id AND o.finding_id=u.finding_id AND o.job_id=u.job_id AND o.variant='original' AND o.complete=1))`)
  await rejectIf('upload_shape',`SELECT 1 FROM ${uploads} WHERE typeof(size)<>'integer' OR size<=0 OR size>33554432 OR mime NOT IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm') OR (mime LIKE 'image/%' AND size>8388608) OR complete NOT IN (0,1) OR (complete=1 AND completed_at IS NULL) OR (complete=0 AND completed_at IS NOT NULL) OR length(sha256)<>64 OR NOT json_valid(actor_json) OR NOT json_valid(request_json) OR (annotations_json IS NOT NULL AND NOT json_valid(annotations_json))`)
  await rejectIf('upload_request',`SELECT 1 FROM ${uploads} WHERE json_type(request_json) IS NOT 'object' OR json_type(actor_json) IS NOT 'object' OR json_extract(request_json,'$.annotations') IS NOT CASE WHEN annotations_json IS NULL THEN NULL ELSE json(annotations_json) END OR json_extract(request_json,'$.findingId') IS NOT finding_id OR json_extract(request_json,'$.variant') IS NOT variant OR json_extract(request_json,'$.originalId') IS NOT original_id OR json_extract(request_json,'$.filename') IS NOT filename OR json_extract(request_json,'$.mime') IS NOT mime OR json_extract(request_json,'$.size') IS NOT size OR json_extract(request_json,'$.sha256') IS NOT sha256 OR json_extract(request_json,'$.capturedAt') IS NOT captured_at`)
 }
 if(clients&&uploads)await rejectIf('media_client',`SELECT 1 FROM ${clients} c WHERE NOT EXISTS(SELECT 1 FROM ${uploads} u WHERE u.id=c.upload_id AND u.finding_id=c.finding_id)`)
 if(resolutions&&findings)await rejectIf('media_resolution',`SELECT 1 FROM ${resolutions} x WHERE NOT EXISTS(SELECT 1 FROM ${findings} f WHERE f.id=x.finding_id AND f.job_id=x.job_id)`)
 if(!uploads)return
 if(chunks){
  await index('mallet_media_chunks','ordinal','upload_id,ordinal',true)
  await rejectIf('chunk_upload',`SELECT 1 FROM ${chunks} c WHERE NOT EXISTS(SELECT 1 FROM ${uploads} u WHERE u.id=c.upload_id)`)
 }
 // At most one upload descriptor, one 64 KiB chunk and one digest are live.
 // Keyset cursors avoid growing OFFSET costs and never call staged.read.
 let after=''
 for(;;){
  const upload=await db.prepare(`SELECT id,size,mime,sha256,complete FROM ${uploads} WHERE id>? ORDER BY id LIMIT 1`).bind(after).first()
  if(!upload)break
  after=upload.id
  if(!hex(upload.sha256))refuse('upload_hash')
  const digest=createHash('sha256');let count=0,total=0,previous=-1
  if(chunks)for(;;){
   const page=await rows(db.prepare(`SELECT ordinal,sha256,byte_length,base64 FROM ${chunks} WHERE upload_id=? AND ordinal>? ORDER BY ordinal LIMIT 1`).bind(upload.id,previous))
   if(!page.length)break
   const chunk=page[0],expected=Math.min(CHUNK_BYTES,upload.size-chunk.ordinal*CHUNK_BYTES)
   if(!Number.isInteger(chunk.ordinal)||chunk.ordinal<0||expected<=0||chunk.byte_length!==expected||!hex(chunk.sha256))refuse('chunk_shape')
   const bytes=Buffer.from(chunk.base64,'base64')
   if(bytes.length!==expected||bytes.toString('base64')!==chunk.base64||createHash('sha256').update(bytes).digest('hex')!==chunk.sha256)refuse('chunk_checksum')
   if(upload.complete&&(chunk.ordinal!==count||!count&&!signature(bytes,upload.mime)))refuse('media_content')
   digest.update(bytes);count++;total+=bytes.length;previous=chunk.ordinal
  }
  // An interrupted upload is legitimate archival state. Only completed
  // uploads promise a contiguous, MIME-checked, whole-file checksum.
  if(upload.complete&&(total!==upload.size||count!==Math.ceil(upload.size/CHUNK_BYTES)||digest.digest('hex')!==upload.sha256))refuse('upload_checksum')
 }
}
