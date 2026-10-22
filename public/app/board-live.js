/* Refresh only board projections. Native forms, drafts and the selected repair
   panel keep their original nodes, values and exact approval versions. */
(()=>{
 const board=document.querySelector('#board')
 if(!board)return
 let version=board.dataset.boardVersion??document.body.dataset.boardVersion??null,timer,controller,stopped=false
 const interval=500
 function status(failed){
  let message=document.querySelector('[data-board-live-status]')
  if(!failed){message?.remove();return}
  if(!message){message=document.createElement('p');message.dataset.boardLiveStatus='';message.setAttribute('role','status');message.className='muted';board.before(message)}
  message.textContent='Board updates unavailable.'
 }
 function activeReference(root){
  const active=document.activeElement
  if(!(active instanceof HTMLElement)||!root.contains(active))return null
  return {element:active,href:active.getAttribute('href'),id:active.id,stage:active.closest('[data-stage]')?.getAttribute('data-stage')}
 }
 function restoreFocus(reference,root){
  if(!reference||reference.element.isConnected)return
  const match=[...root.querySelectorAll('[href],[id]')].find(node=>reference.id?node.id===reference.id:reference.href&&node.getAttribute('href')===reference.href)
  const target=match??(root.matches('.column')?root.querySelector('h2'):root.querySelector(`.column[data-stage="${CSS.escape(reference.stage??'')}"] h2`))
  if(target instanceof HTMLElement){if(!match)target.tabIndex=-1;target.focus({preventScroll:true})}
 }
 function replaceProjection(current,incoming){
  // The current board contains links only. If a native form is added later,
  // keep that subtree intact rather than replacing a user's in-flight input.
  if(current.querySelector('form,input,textarea,select')||incoming.querySelector('form,input,textarea,select'))return false
  const focus=activeReference(current),left=current.scrollLeft,top=current.scrollTop
  current.replaceChildren(...incoming.childNodes)
  current.scrollLeft=left;current.scrollTop=top;restoreFocus(focus,current)
  return true
 }
 async function read(url,signal){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',signal})
  if(!response.ok)throw Error('Board projection unavailable')
  return response
 }
 async function poll(){
  if(stopped||document.visibilityState!=='visible')return
  controller=new AbortController()
  const timeout=setTimeout(()=>controller?.abort(),4000)
  try{
   const revision=await(await read('/api/mallet/board-revision',controller.signal)).json()
   if(!Number.isSafeInteger(revision.version)||revision.version<0)throw Error('Invalid board revision')
   if(String(revision.version)!==version){
    const response=await read(location.pathname+location.search,controller.signal),html=new DOMParser().parseFromString(await response.text(),'text/html'),incoming=html.querySelector('#board'),nextVersion=incoming?.dataset.boardVersion??html.body.dataset.boardVersion
    if(!incoming||!nextVersion||!Number.isSafeInteger(Number(nextVersion))||Number(nextVersion)<revision.version)throw Error('Board projection changed while reading')
    const currentColumns=[...board.children].filter(node=>node.matches('.column[data-stage]')),nextColumns=[...incoming.children].filter(node=>node.matches('.column[data-stage]'))
    if(currentColumns.length!==nextColumns.length||currentColumns.some((node,index)=>node.dataset.stage!==nextColumns[index].dataset.stage))throw Error('Board projection does not match this view')
    const x=scrollX,y=scrollY,left=board.scrollLeft,top=board.scrollTop,boardFocus=activeReference(board)
    let complete=true
    for(let index=0;index<currentColumns.length;index++)complete=replaceProjection(currentColumns[index],nextColumns[index])&&complete
    const bays=document.querySelector('.bays'),newBays=html.querySelector('.bays')
    if(bays&&newBays)complete=replaceProjection(bays,newBays)&&complete
    else if(bays&&!newBays){if(bays.querySelector('form,input,textarea,select'))complete=false;else bays.replaceChildren()}
    else if(!bays&&newBays){const anchor=document.querySelector('.advisor,.board-filters')??board;anchor.before(newBays)}
    // Never reconstruct the full page or remove a form when a projection is
    // temporarily missing (for example while an owner changes a filter).
    if(!complete)throw Error('An active form prevents board replacement')
    restoreFocus(boardFocus,board);board.scrollLeft=left;board.scrollTop=top;window.scrollTo(x,y)
    version=nextVersion;board.dataset.boardVersion=nextVersion
    document.dispatchEvent(new CustomEvent('mallet:board-updated',{detail:{version:Number(nextVersion)}}))
   }
   status(false)
  }catch(error){if(!stopped&&document.visibilityState==='visible')status(true)}
  finally{clearTimeout(timeout);controller=null;if(!stopped&&document.visibilityState==='visible')timer=setTimeout(poll,interval)}
 }
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.visibilityState==='visible'){if(!controller)poll()}else controller?.abort()})
 addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);controller?.abort()},{once:true})
 timer=setTimeout(poll,interval)
})()
