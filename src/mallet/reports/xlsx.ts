// Office Open XML with stored ZIP members. Cells are data only, never formulas.
const encoder=new TextEncoder()
const xml=(s:string)=>s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!))
function csvRows(csv:string){
 const result:string[][]=[],row:string[]=[];let value='',quoted=false
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\r'||c==='\n')){row.push(value);value='';if(c!==','){result.push(row.splice(0));if(c==='\r'&&csv[i+1]==='\n')i++}}else value+=c}
 if(value||row.length){row.push(value);result.push(row)}return result
}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function zip(files:Record<string,string>){
 const parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0,size=0
 for(const [name,value] of Object.entries(files)){
  const filename=encoder.encode(name),data=encoder.encode(value),crc=crc32(data),local=new Uint8Array(30+filename.length),v=new DataView(local.buffer)
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,filename.length,true);local.set(filename,30)
  const directory=new Uint8Array(46+filename.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,filename.length,true);d.setUint32(42,offset,true);directory.set(filename,46)
  parts.push(local,data);central.push(directory);offset+=local.length+data.length;size+=directory.length
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true)
 const bytes=new Uint8Array(offset+size+22);let cursor=0;for(const part of [...parts,...central,end]){bytes.set(part,cursor);cursor+=part.length}return bytes
}
export function reportXlsx(csv:string){
 const rows=csvRows(csv),headers=rows[0],valueIndex=headers.indexOf('Value'),unitIndex=headers.indexOf('Unit')
 const cells=rows.map((row,n)=>'<row r="'+(n+1)+'">'+row.map((value,col)=>{
  const ref=String.fromCharCode(65+col)+(n+1),numeric=n>0&&col===valueIndex&&/^(?:count|milliseconds|USD cents|thousandths of an hour|tenths of a percent)$/.test(row[unitIndex])&&/^-?\d+(?:\.\d+)?$/.test(value)
  return numeric?`<c r="${ref}"><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
 }).join('')+'</row>').join('')
 return zip({
 '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml':'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+cells+'</sheetData></worksheet>'
 })
}
