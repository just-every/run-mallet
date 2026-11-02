# Private diagnostic result files

The owner can paste an authorized Phonecheck **Device Info** JSON response on a
device repair's Provider result files panel. This adapter follows the original
`Serial`, `IMEI`, `AppVersion`, `BuildNo`, `Passed`, `Failed` and `Pending` fields in
[Phonecheck's Device Info documentation](https://phonecheck.atlassian.net/wiki/spaces/KB/pages/24117261/PhoneCheck+API+to+Get+Device+Info).
It does not accept an A4 report, a multi-device/history envelope, or an OS version
as the diagnostic application version. The original UTF-8 JSON is limited to
64 KiB and retained exactly with its SHA-256. Reimporting identical bytes for the
same repair returns the original record.

The provider serial or IMEI must match the visit's saved serial/identifier. If an
IMEI was also recorded on that visit, it must match too. Comparison is case
insensitive, without punctuation removal or device lookup. A mismatch remains
quarantined with its raw evidence and cannot become repair findings. A match
asserts only that the identifiers match. Mallet neither verifies the source nor
runs a diagnostic test. Passed, Failed and Pending retain the provider's exact
strings; shop explanations remain separate diagnostic notes.

The conservative default is owner-only import and inspection, private retained
originals, no automatic customer sharing or outbound provider call, and no work,
charge, safety certification or erasure authority. Backups and private owner
customer exports include related raw evidence; review a package before giving
it to someone else. GOV-006 governs retention. This default awaits ct approval,
so DIAG-002 remains partial. Vehicle scan-tool and Blackbelt360 adapters require
an authorized source format/result and are not implemented. No live provider
account or API integration is claimed.
