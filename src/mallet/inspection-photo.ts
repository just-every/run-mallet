import {fail,text} from './model'
import {uploadScope,listFindings} from './media/service'
import {uploadView} from './media/types'
import type {Actor,Authority} from './auth'

/** Bind inspection observations to real private photo custody, never caller claims. */
export async function inspectionRecordInput(db:D1Database,actor:Actor,authority:Authority,raw:any) {
 const input={...raw,photo:null}
 if(!['yellow','red'].includes(input.outcome)&&(input.photoUploadId===undefined||input.photoUploadId===null||input.photoUploadId===''))return {input,authority}
 const id=text(input.photoUploadId,'completed inspection photo'),{row}=await uploadScope(db,actor,authority,id)
 if(row.job_id!==input.jobId||!row.complete||!row.mime.startsWith('image/'))fail('INSPECTION_EVIDENCE','Choose a completed private photo belonging to this repair.',null,400)
 const photo=uploadView(row)
 input.photo={id:photo.id,findingId:photo.findingId,variant:photo.variant,originalId:photo.originalId,filename:photo.filename,mime:photo.mime,sha256:photo.sha256,capturedAt:photo.capturedAt,receivedAt:photo.receivedAt,by:photo.by}
 return {input,authority:{sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM mallet_media_uploads WHERE id=? AND job_id=? AND complete=1 AND sha256=?)`,params:[...authority.params,row.id,row.job_id,row.sha256]}}
}
export async function inspectionPhotos(db:D1Database,actor:Actor,authority:Authority,jobId:string) {
 if(actor.role==='agent')return []
 const {findings}=await listFindings(db,actor,authority,jobId)
 return findings.flatMap((finding:any)=>finding.media.filter((m:any)=>m.complete&&m.mime.startsWith('image/')).map((m:any)=>({id:m.id,label:`${finding.title} · ${m.filename} · ${m.variant}`})))
}
