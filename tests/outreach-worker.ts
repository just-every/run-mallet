// Only this test Worker fixes wall time. Production continues to use the real clock.
import worker from './worker'
const NativeDate=Date
let clock=NativeDate.parse('2026-10-28T12:00:00Z')
class JourneyDate extends NativeDate {
 constructor(value?:string|number){super(value===undefined?clock:value)}
 static now(){return clock}
}
globalThis.Date=JourneyDate as DateConstructor
export default {
 async fetch(request:Request,env:any,context:ExecutionContext){clock=NativeDate.parse(env.TEST_NOW??'2026-10-28T12:00:00Z');return worker.fetch(request,env,context)},
 async scheduled(controller:ScheduledController,env:any){clock=NativeDate.parse(env.TEST_NOW??'2026-10-28T12:00:00Z');return worker.scheduled(controller,env)}
}
