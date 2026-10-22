// RFC 6238 time-based codes (HMAC-SHA-1, six digits, thirty seconds) with a one-step skew either side.
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const STEP_SECONDS=30
export function base32(bytes:Uint8Array){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=ALPHABET[(value>>>(bits-5))&31];bits-=5}}if(bits>0)out+=ALPHABET[(value<<(5-bits))&31];return out}
export async function codeAt(secret:Uint8Array<ArrayBuffer>,step:number){
 const counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(step))
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-1'},false,['sign']),counter)),offset=mac[19]&15
 const value=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3]
 return String(value%1000000).padStart(6,'0')
}
/** The accepted step for a submitted code, or null. Callers refuse a step at or before the last one used. */
export async function matchStep(secret:Uint8Array<ArrayBuffer>,code:string,nowMs:number){
 if(!/^\d{6}$/.test(code))return null
 const now=Math.floor(nowMs/1000/STEP_SECONDS);let found:number|null=null
 for(const step of [now-1,now,now+1])if(await codeAt(secret,step)===code&&(found===null||step>found))found=step
 return found
}
export const otpauth=(issuer:string,account:string,secret:Uint8Array)=>`otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${base32(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`
