declare module '@runeditrun/rer/modules/portability/http' {
 export function boundedJson(request:{body:ReadableStream<Uint8Array>|null},limit:number):Promise<unknown>
}
declare module '@runeditrun/rer/modules/portability/format' {
 export const MAX_LINE_BYTES:number
}
