import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {inflateRawSync} from 'node:zlib'
import {createServer} from 'node:https'
import {DOMParser} from '@xmldom/xmldom'
import {SignedXml} from 'xml-crypto'

const PROTOCOL='urn:oasis:names:tc:SAML:2.0:protocol',ASSERTION='urn:oasis:names:tc:SAML:2.0:assertion'
const EXCLUSIVE='http://www.w3.org/2001/10/xml-exc-c14n#',ENVELOPED='http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const RSA_SHA256='http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',SHA256='http://www.w3.org/2001/04/xmlenc#sha256'
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const id=()=>'_'+randomBytes(32).toString('hex')
export const responseCookies=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
export const samlEndpoints=(h,p)=>({audience:h.origin+'/auth/saml/'+p.id+'/metadata',acs:h.origin+'/auth/saml/'+p.id+'/acs'})

// This is only the external IdP edge. Admission, sessions, SCIM, factors and storage
// always go through the real Worker. No certificate or private key is committed.
export function samlProviderEdge(){
 const scratch=mkdtempSync(join(tmpdir(),'synthetic-mallet-saml-'))
 let privateKey,certificate
 try{
  const keyPath=join(scratch,'key.pem'),certPath=join(scratch,'cert.pem')
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','2','-subj','/CN=synthetic-mallet-idp','-keyout',keyPath,'-out',certPath],{stdio:'pipe'})
  privateKey=readFileSync(keyPath,'utf8');certificate=readFileSync(certPath,'utf8')
 }finally{rmSync(scratch,{recursive:true,force:true})}
 const providers=[
  {id:'enterprise-okta-saml',preset:'okta',issuer:'http://www.okta.com/synthetic-mallet',ssoUrl:'https://synthetic-mallet-idp.example/sso',certificate,label:'Okta SAML'},
  {id:'enterprise-other-saml',preset:'okta',issuer:'http://www.okta.com/synthetic-mallet-other',ssoUrl:'https://synthetic-mallet-other-idp.example/sso',certificate,label:'Other SAML'},
 ]
 function signed(document,tag,referenceId){
  const signature=new SignedXml({privateKey,publicCert:certificate,signatureAlgorithm:RSA_SHA256,canonicalizationAlgorithm:EXCLUSIVE})
  const element=`//*[local-name(.)='${tag}' and @ID='${referenceId}']`
  signature.addReference({xpath:element,transforms:[ENVELOPED,EXCLUSIVE],digestAlgorithm:SHA256})
  signature.computeSignature(document,{prefix:'ds',location:{reference:element+"/*[local-name(.)='Issuer']",action:'after'}})
  return signature.getSignedXml()
 }
 async function start(h,p,{form=false,returnTo='/app/jobs'}={}){
  const path='/auth/saml/'+p.id+'/start'
  const response=form
   ?await h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({returnTo}).toString()})
   :await h.request(path,{method:'POST',as:'',body:{returnTo}})
  assert.equal(response.status,303,await response.clone().text())
  const destination=new URL(response.headers.get('location'))
  assert.equal(destination.origin+destination.pathname,p.ssoUrl)
  const encoded=destination.searchParams.get('SAMLRequest');assert.ok(encoded,'IdP receives a SAML AuthnRequest')
  const document=new DOMParser().parseFromString(inflateRawSync(Buffer.from(encoded,'base64')).toString('utf8'),'text/xml')
  const request=document.documentElement,endpoints=samlEndpoints(h,p)
  assert.equal(request.namespaceURI,PROTOCOL);assert.equal(request.localName,'AuthnRequest')
  assert.equal(request.getAttribute('AssertionConsumerServiceURL'),endpoints.acs)
  assert.equal(request.getAttribute('Destination'),p.ssoUrl)
  assert.equal(request.getElementsByTagNameNS(ASSERTION,'Issuer')[0]?.textContent,endpoints.audience)
  const requestId=request.getAttribute('ID'),cookie=responseCookies(response)
  assert.ok(requestId,'AuthnRequest has a correlation ID');assert.ok(cookie,'Browser receives the request binding')
  return {id:requestId,cookie,response,relayState:destination.searchParams.get('RelayState')}
 }
 function issue(h,p,transaction,subject,options={}){
  const endpoints=samlEndpoints(h,p),now=Date.now(),stamp=offset=>new Date(now+offset).toISOString()
  const responseId=id(),assertionId=id(),issuer=options.issuer??p.issuer
  const requestId=options.requestId??transaction.id
  const correlation=options.unsolicited?'':` InResponseTo="${xml(requestId)}"`
  const assertionIssuer=options.assertionIssuer??issuer
  const nameId=options.nameId??subject
  const attributes=options.email?`<saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>${xml(options.email)}</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>`:''
  let document=`<samlp:Response xmlns:samlp="${PROTOCOL}" xmlns:saml="${ASSERTION}" ID="${responseId}" Version="2.0" IssueInstant="${xml(options.issueInstant??stamp(0))}" Destination="${xml(options.destination??endpoints.acs)}"${correlation}>
<saml:Issuer>${xml(issuer)}</saml:Issuer>
<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
<saml:Assertion ID="${assertionId}" Version="2.0" IssueInstant="${xml(options.assertionIssueInstant??stamp(0))}">
<saml:Issuer>${xml(assertionIssuer)}</saml:Issuer>
<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">${xml(nameId)}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData InResponseTo="${xml(options.subjectRequestId??requestId)}" Recipient="${xml(options.recipient??endpoints.acs)}" NotOnOrAfter="${xml(options.subjectExpires??stamp(300000))}"/></saml:SubjectConfirmation></saml:Subject>
<saml:Conditions NotBefore="${xml(options.notBefore??stamp(-60000))}" NotOnOrAfter="${xml(options.expires??stamp(300000))}"><saml:AudienceRestriction><saml:Audience>${xml(options.audience??endpoints.audience)}</saml:Audience></saml:AudienceRestriction></saml:Conditions>
<saml:AuthnStatement AuthnInstant="${xml(options.authnInstant??stamp(0))}" SessionIndex="${id()}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>${attributes}
</saml:Assertion></samlp:Response>`
  if(options.signAssertion!==false)document=signed(document,'Assertion',assertionId)
  if(options.signResponse!==false)document=signed(document,'Response',responseId)
  return document
 }
 async function post(h,p,transaction,document,{cookie=transaction.cookie,relayState=transaction.relayState}={}){
  const form=new URLSearchParams({SAMLResponse:Buffer.from(document).toString('base64')})
  if(relayState!==null&&relayState!==undefined)form.set('RelayState',relayState)
  return h.mf.dispatchFetch(samlEndpoints(h,p).acs,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',...(cookie?{cookie}:{})},body:form.toString()})
 }
 async function signIn(h,p,subject,options={}){
  const transaction=await start(h,p,options),document=issue(h,p,transaction,subject,options),response=await post(h,p,transaction,document)
  assert.equal(response.status,303,await response.clone().text())
  return {transaction,document,response,cookie:responseCookies(response)}
 }
 async function listen(render){
  const server=createServer({key:privateKey,cert:certificate},(request,response)=>{
   try{
    const url=new URL(request.url,'https://localhost')
    if(request.method!=='GET'||url.pathname!=='/sso'){response.writeHead(404);response.end();return}
    response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end(render(url))
   }catch{response.writeHead(500);response.end('Synthetic provider request failed')}
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  return {origin:'https://localhost:'+server.address().port,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}}
 }
 return {providers,start,issue,post,signIn,listen}
}
