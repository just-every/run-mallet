// Passkey ceremonies for /app/security: options and verification stay on the server; this only calls the browser's
// credential API and posts the result. Without it the authenticator-app and recovery-code forms still work.
export const SECURITY_SCRIPT=`(()=>{const root=document.querySelector("[data-security]");if(!root)return;
const bin=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0)),text=a=>btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=/g,"");
const post=async(path,body)=>{const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.message||"That did not work.");return j};
for(const button of root.querySelectorAll("[data-passkey]"))button.addEventListener("click",async()=>{const status=root.querySelector("[data-passkey-status]"),back=button.dataset.returnTo||"/app/security";status.textContent="";
try{let result;
if(button.dataset.passkey==="register"){const o=await post("/api/mallet/security/passkey/register-options",{}),k=o.publicKey;k.challenge=bin(k.challenge);k.user.id=bin(k.user.id);k.excludeCredentials=k.excludeCredentials.map(x=>({...x,id:bin(x.id)}));
const c=await navigator.credentials.create({publicKey:k}),r=c.response;result=await post("/api/mallet/security/passkey/register",{challengeId:o.challengeId,id:c.id,clientDataJSON:text(r.clientDataJSON),attestationObject:text(r.attestationObject),label:root.querySelector("[name=passkeyLabel]").value})}
else{const o=await post("/api/mallet/security/verify/passkey-options",{}),k=o.publicKey;k.challenge=bin(k.challenge);k.allowCredentials=k.allowCredentials.map(x=>({...x,id:bin(x.id)}));
const c=await navigator.credentials.get({publicKey:k}),r=c.response;result=await post("/api/mallet/security/verify/passkey",{challengeId:o.challengeId,id:c.id,clientDataJSON:text(r.clientDataJSON),authenticatorData:text(r.authenticatorData),signature:text(r.signature)})}
if(result.recoveryCodes){root.querySelector("[data-new-codes]").innerHTML="<p>Save these recovery codes now. Each works once and they are not shown again.</p><pre>"+result.recoveryCodes.join("\\n")+"</pre><p><a href=\\""+back+"\\">Continue</a></p>"}else location.href=back}
catch(error){status.textContent=error.message||"That did not work."}})})();`
