-- Preserve historical prices and totals. Former tax flags are immutable 10%
-- line snapshots, not a guess at the shop's current US sales tax jurisdiction.
WITH RECURSIVE
changes AS (
  SELECT r.kind, r.id,
    row_number() OVER (PARTITION BY r.kind,r.id ORDER BY j.fullkey) AS step,
    j.key AS field, j.path AS parent, j.fullkey AS location
  FROM mallet_records r, json_tree(r.value) j
  WHERE j.key IN ('gst','gstCents')
     OR (j.key='currency' AND j.atom='AUD')
     OR (j.key='kind' AND j.atom='labour')
),
converted(kind,id,step,value) AS (
  SELECT kind,id,0,value FROM mallet_records
  UNION ALL
  SELECT c.kind,c.id,a.step,
    CASE a.field
      WHEN 'gst' THEN json_set(json_remove(c.value,a.location),
        a.parent||'.taxable',json(CASE json_extract(c.value,a.location) WHEN 1 THEN 'true' ELSE 'false' END),
        a.parent||'.taxRatePercent',10,a.parent||'.taxRateMillionths',100000)
      WHEN 'gstCents' THEN json_set(json_remove(c.value,a.location),a.parent||'.salesTaxCents',json_extract(c.value,a.location))
      WHEN 'currency' THEN json_set(c.value,a.location,'USD')
      WHEN 'kind' THEN json_set(c.value,a.location,'labor')
    END
  FROM converted c JOIN changes a ON a.kind=c.kind AND a.id=c.id AND a.step=c.step+1
)
UPDATE mallet_records AS r
SET value=(SELECT c.value FROM converted c WHERE c.kind=r.kind AND c.id=r.id ORDER BY c.step DESC LIMIT 1)
WHERE EXISTS(SELECT 1 FROM changes a WHERE a.kind=r.kind AND a.id=r.id);

-- CSV fields are all quoted. Change only the header and the terminal currency
-- cell, retaining customer text, original cents and the export journal identity.
UPDATE mallet_records
SET value=json_set(value,'$.csv',
  replace(replace(replace(replace(
    substr(json_extract(value,'$.csv'),1,instr(json_extract(value,'$.csv'),char(13)||char(10))-1),
    '"UnitAUD"','"UnitUSD"'),'"SubtotalAUD"','"SubtotalUSD"'),'"GSTAUD"','"SalesTaxUSD"'),'"TotalAUD"','"TotalUSD"')
  || replace(substr(json_extract(value,'$.csv'),instr(json_extract(value,'$.csv'),char(13)||char(10))),',"AUD"'||char(13)||char(10),',"USD"'||char(13)||char(10)))
WHERE kind='export' AND json_extract(value,'$.format')='mallet-invoice-csv'
  AND instr(json_extract(value,'$.csv'),char(13)||char(10))>0;

-- An absent settings record means the owner still needs to configure tax.
-- Keep a pristine installation empty so installation archive restore remains valid.
