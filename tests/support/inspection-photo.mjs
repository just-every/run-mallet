import {createHash,randomUUID} from 'node:crypto'
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
export async function inspectionPhoto(h,jobId,cookie,title='Front brake pads'){
 const options={as:cookie},finding=await h.api('/api/mallet/media/findings',{jobId,clientId:randomUUID(),title,capturedAt:'2026-10-19T09:15:00-04:00'},options)
 const sha256=createHash('sha256').update(pixel).digest('hex')
 let upload=await h.api('/api/mallet/media/uploads',{findingId:finding.id,clientId:randomUUID(),variant:'original',filename:title.toLowerCase().replaceAll(' ','-')+'.png',mime:'image/png',size:pixel.length,sha256,capturedAt:finding.capturedAt},options)
 await h.api('/api/mallet/media/uploads/'+upload.id+'/chunks/0',{sha256,base64:pixel.toString('base64')},{...options,method:'PUT'})
 upload=await h.api('/api/mallet/media/uploads/'+upload.id+'/complete',{},options)
 return upload
}
