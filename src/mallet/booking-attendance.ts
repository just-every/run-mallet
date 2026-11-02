import {bump,choice,event,expectVersion,fail,find,text,who,type Context,type Row} from './model'

export const attendanceObservations=(appointment:Row)=>appointment.attendance?[appointment.attendance,...(appointment.attendanceCorrections??[])]:[]
export const latestAttendance=(appointment:Row)=>attendanceObservations(appointment).at(-1)??null

export function recordAttendance(c:Context,p:any){
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records observed appointment attendance.',null,403)
 const row=find(c.s,'appointment',p.appointmentId);expectVersion(row,p.version)
 if(row.status!=='confirmed'||row.startAt>c.now)fail('BOOKING_ATTENDANCE','Record attendance after a confirmed appointment starts.')
 const observation={outcome:choice(p.outcome,['arrived','no-show'],'observed attendance'),evidence:text(p.evidence,'staff attendance evidence',2000),...(row.attendance?{reason:text(p.reason,'attendance correction reason',2000)}:{}),by:who(c),at:c.now}
 // The original observation and every correction remain unchanged; a correction appends new evidence.
 const next=bump(c.s,'appointment',row,row.attendance?{attendanceCorrections:[...(row.attendanceCorrections??[]),observation]}:{attendance:observation})
 event(c,'booking.attendance',null,row.id,observation);return next
}
