import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
// The independent Python ZIP and XML readers validate the public download.
export async function downloadWorkbook(h,path,options={}){
 const response=await h.request(path,options);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/spreadsheetml/)
 const result=spawnSync('python3',['-c',`import io,json,sys,zipfile,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
for name in z.namelist(): E.fromstring(z.read(name))
n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sheet=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
assert not sheet.findall('.//s:f',n)
rows=[[c.find('s:v',n).text if c.find('s:v',n) is not None else ''.join(c.itertext()) for c in r] for r in sheet.findall('.//s:row',n)]
print(json.dumps([dict(zip(rows[0],r)) for r in rows[1:]]))`],{input:Buffer.from(await response.arrayBuffer()),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout)
}
