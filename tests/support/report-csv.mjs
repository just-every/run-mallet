import assert from 'node:assert/strict'
// Read actual downloaded CSV, including quoted commas, quotes and line breaks.
export function csvRecords(text){
 const rows=[],row=[];let value='',quoted=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}
  else if(c===','&&!quoted){row.push(value);value=''}
  else if(c==='\r'&&!quoted&&text[i+1]==='\n'){row.push(value);rows.push(row.splice(0));value='';i++}
  else value+=c
 }
 assert.equal(quoted,false);assert.equal(value,'');assert.equal(row.length,0)
 const keys=rows.shift()
 return rows.map(values=>{assert.equal(values.length,keys.length);return Object.fromEntries(keys.map((key,i)=>[key,values[i]]))})
}
export async function downloadReport(h,path,options={}){
 const response=await h.request(path,options)
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'text/csv; charset=utf-8');assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-disposition'),/^attachment; filename="mallet-(technicians|turnaround)-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv"$/)
 return csvRecords(await response.text())
}
