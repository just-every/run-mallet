// WebAuthn passkeys as a second factor: ES256 credentials, "none" attestation, user verification required.
import {b64,unb64} from './secret-box'
export class PasskeyError extends Error{}
const fail=(reason:string):never=>{throw new PasskeyError(reason)}
// A minimal CBOR reader for attestation objects and COSE keys (definite lengths only).
function cbor(bytes:Uint8Array,at={i:0}):any{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),first=bytes[at.i++],type=first>>5,info=first&31
 const length=()=>{if(info<24)return info;if(info===24)return bytes[at.i++];if(info===25){const v=view.getUint16(at.i);at.i+=2;return v}if(info===26){const v=view.getUint32(at.i);at.i+=4;return v}return fail('cbor')}
 if(type===0)return length()
 if(type===1)return -1-length()
 if(type===2||type===3){const n=length(),slice=bytes.slice(at.i,at.i+n);if(slice.length!==n)fail('cbor');at.i+=n;return type===2?slice:new TextDecoder().decode(slice)}
 if(type===4){const n=length(),out=[];for(let k=0;k<n;k++)out.push(cbor(bytes,at));return out}
 if(type===5){const n=length(),out=new Map();for(let k=0;k<n;k++){const key=cbor(bytes,at);out.set(key,cbor(bytes,at))}return out}
 return fail('cbor')
}
const sha256=async(data:BufferSource)=>new Uint8Array(await crypto.subtle.digest('SHA-256',data))
const same=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((x,i)=>x===b[i])
export const challengeBytes=()=>crypto.getRandomValues(new Uint8Array(32))
function clientData(raw:string,type:string,challenge:string,origin:string){
 let data:any;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(unb64(raw)))}catch{fail('client_data')}
 if(data?.type!==type||data.challenge!==challenge||data.origin!==origin||data.crossOrigin===true)fail('client_data')
}
function authData(data:Uint8Array,rpHash:Uint8Array){
 if(data.length<37||!same(data.slice(0,32),rpHash))fail('rp_id')
 const flags=data[32],count=new DataView(data.buffer,data.byteOffset).getUint32(33)
 if(!(flags&1)||!(flags&4))fail('user_verification')
 return {flags,count}
}
/** Verify a registration and return what to store: credential id, raw P-256 public key and counter. */
export async function verifyRegistration(input:any,expect:{challenge:string;origin:string;rpId:string}){
 if(typeof input?.id!=='string'||typeof input.clientDataJSON!=='string'||typeof input.attestationObject!=='string')fail('shape')
 clientData(input.clientDataJSON,'webauthn.create',expect.challenge,expect.origin)
 const attestation=cbor(unb64(input.attestationObject));if(!(attestation instanceof Map)||!(attestation.get('authData') instanceof Uint8Array))fail('attestation')
 const data=attestation.get('authData') as Uint8Array,{flags,count}=authData(data,await sha256(new TextEncoder().encode(expect.rpId)))
 if(!(flags&64)||data.length<55)fail('credential_data')
 const idLength=(data[53]<<8)|data[54],id=data.slice(55,55+idLength);if(id.length!==idLength||idLength<16||idLength>1023||b64(id)!==input.id)fail('credential_id')
 const at={i:55+idLength},key=cbor(data,at)
 if(!(key instanceof Map)||key.get(1)!==2||key.get(3)!==-7||key.get(-1)!==1)fail('algorithm')
 const x=key.get(-2),y=key.get(-3);if(!(x instanceof Uint8Array)||!(y instanceof Uint8Array)||x.length!==32||y.length!==32)fail('public_key')
 const raw=new Uint8Array(65);raw[0]=4;raw.set(x,1);raw.set(y,33)
 await crypto.subtle.importKey('raw',raw,{name:'ECDSA',namedCurve:'P-256'},false,['verify']).catch(()=>fail('public_key'))
 return {credentialId:input.id,publicKey:b64(raw),signCount:count}
}
// ECDSA signatures arrive DER encoded; WebCrypto verifies the fixed-width r||s form.
function der(sig:Uint8Array){
 let i=2;if(sig[0]!==0x30)fail('signature');if(sig[1]&0x80)i++
 const part=()=>{if(sig[i++]!==2)fail('signature');let n=sig[i++],bytes=sig.slice(i,i+n);i+=n;while(bytes.length>32&&bytes[0]===0)bytes=bytes.slice(1);if(bytes.length>32)fail('signature');const out=new Uint8Array(32);out.set(bytes,32-bytes.length);return out}
 const r=part(),s=part(),out=new Uint8Array(64);out.set(r);out.set(s,32);return out
}
/** Verify an assertion against a stored credential; returns the new counter. A non-increasing non-zero counter is a clone signal. */
export async function verifyAssertion(input:any,stored:{publicKey:string;signCount:number},expect:{challenge:string;origin:string;rpId:string}){
 if(typeof input?.clientDataJSON!=='string'||typeof input.authenticatorData!=='string'||typeof input.signature!=='string')fail('shape')
 clientData(input.clientDataJSON,'webauthn.get',expect.challenge,expect.origin)
 const data=unb64(input.authenticatorData),{count}=authData(data,await sha256(new TextEncoder().encode(expect.rpId)))
 if((count>0||stored.signCount>0)&&count<=stored.signCount)fail('counter')
 const signed=new Uint8Array(data.length+32);signed.set(data);signed.set(await sha256(unb64(input.clientDataJSON)),data.length)
 const key=await crypto.subtle.importKey('raw',unb64(stored.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify'])
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,der(unb64(input.signature)),signed))fail('signature')
 return count
}
