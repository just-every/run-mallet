// A fixed test clock wraps the deployed HTTP chain. Production has no clock door.
import worker from './worker'
const NativeDate=Date
let clock=NativeDate.now()
globalThis.Date=new Proxy(NativeDate,{construct(target,args){return Reflect.construct(target,args.length?args:[clock])},apply(){return new NativeDate(clock).toString()},get(target,key){return key==='now'?()=>clock:Reflect.get(target,key)}})
export default {fetch(request:Request,env:any,execution:ExecutionContext){clock=NativeDate.parse(env.TEST_STORAGE_CLOCK);return worker.fetch(request,env,execution)}}
