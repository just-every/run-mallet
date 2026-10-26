/** Historical attribution is data, never destination identity authority. */
export async function validateCostRates({table,rejectIf}){
 const records=table('mallet_records');if(!records)return
 await rejectIf('cost_rate_shape',`SELECT 1 FROM ${records} r WHERE kind='costRate' AND (
 json_type(value,'$.technicianId') IS NOT 'text' OR length(trim(json_extract(value,'$.technicianId')))=0 OR
 json_type(value,'$.revisions') IS NOT 'array' OR json_array_length(value,'$.revisions')<1 OR
 EXISTS(SELECT 1 FROM json_each(r.value,'$.revisions') rev WHERE rev.type<>'object' OR
 json_type(rev.value,'$.centsPerHour') IS NOT 'integer' OR json_extract(rev.value,'$.centsPerHour') NOT BETWEEN 0 AND 1000000 OR
 json_type(rev.value,'$.reason') IS NOT 'text' OR length(trim(json_extract(rev.value,'$.reason')))=0 OR
 json_extract(rev.value,'$.by.role') IS NOT 'owner' OR julianday(json_extract(rev.value,'$.at')) IS NULL OR
 json_type(rev.value,'$.effectiveFrom') IS NOT 'text' OR length(json_extract(rev.value,'$.effectiveFrom'))<>10 OR
 date(json_extract(rev.value,'$.effectiveFrom'),'+0 days') IS NOT json_extract(rev.value,'$.effectiveFrom')))`)
 await rejectIf('cost_rate_unique',`SELECT 1 FROM ${records} WHERE kind='costRate' GROUP BY json_extract(value,'$.technicianId') HAVING count(*)>1`)
}
