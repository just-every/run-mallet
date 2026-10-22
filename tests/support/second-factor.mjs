// Test-side second factors: an authenticator app (RFC 6238) and a software passkey device that speaks WebAuthn.
import {createHmac,createHash,generateKeyPairSync,createSign,randomBytes} from 'node:crypto'
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function unbase32(text){let bits=0,value=0;const out=[];for(const c of text){value=(value<<5)|ALPHABET.indexOf(c);bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}return Buffer.from(out)}
export function totpCode(secret,at=Date.now(),skew=0){
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(at/30000)+skew))
 const mac=createHmac('sha1',unbase32(secret)).update(counter).digest(),offset=mac[19]&15
 return String(((mac[offset]&127)<<24|mac[offset+1]<<16|mac[offset+2]<<8|mac[offset+3])%1000000).padStart(6,'0')
}
const b64=buffer=>Buffer.from(buffer).toString('base64url')
const cbor=value=>{
 const head=(type,n)=>n<24?Buffer.from([type<<5|n]):n<256?Buffer.from([type<<5|24,n]):Buffer.from([type<<5|25,n>>8,n&255])
 if(typeof value==='number')return value>=0?head(0,value):head(1,-1-value)
 if(typeof value==='string')return Buffer.concat([head(3,Buffer.byteLength(value)),Buffer.from(value)])
 if(Buffer.isBuffer(value))return Buffer.concat([head(2,value.length),value])
 const entries=[...value];return Buffer.concat([head(5,entries.length),...entries.flatMap(([k,v])=>[cbor(k),cbor(v)])])
}
/** A software passkey: ES256, user verified, with a counter the test can hold back to simulate a cloned credential. */
export function passkeyDevice({origin,rpId=new URL(origin).hostname,counter=0,verified=true}={}) {
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=publicKey.export({format:'jwk'}),credentialId=randomBytes(32)
 const rpHash=createHash('sha256').update(rpId).digest(),flags=(extra=0)=>(verified?5:1)|extra
 const clientData=(type,challenge,at=origin)=>Buffer.from(JSON.stringify({type,challenge,origin:at,crossOrigin:false}))
 const device={credentialId:b64(credentialId),counter,
  create(publicKeyOptions,{at=origin}={}){
   const key=new Map([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x,'base64url')],[-3,Buffer.from(jwk.y,'base64url')]]),count=Buffer.alloc(4),length=Buffer.alloc(2);length.writeUInt16BE(credentialId.length)
   const authData=Buffer.concat([rpHash,Buffer.from([flags(64)]),count,Buffer.alloc(16),length,credentialId,cbor(key)])
   return {id:b64(credentialId),clientDataJSON:b64(clientData('webauthn.create',publicKeyOptions.challenge,at)),attestationObject:b64(cbor(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]])))}
  },
  get(publicKeyOptions,{at=origin,count}={}){
   const next=count??++device.counter,counterBytes=Buffer.alloc(4);counterBytes.writeUInt32BE(next)
   const authData=Buffer.concat([rpHash,Buffer.from([flags()]),counterBytes]),data=clientData('webauthn.get',publicKeyOptions.challenge,at)
   const signature=createSign('sha256').update(Buffer.concat([authData,createHash('sha256').update(data).digest()])).sign(privateKey)
   return {id:b64(credentialId),clientDataJSON:b64(data),authenticatorData:b64(authData),signature:b64(signature)}
  }}
 return device
}
