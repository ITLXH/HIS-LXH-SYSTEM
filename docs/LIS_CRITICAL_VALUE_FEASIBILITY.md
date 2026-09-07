# LIS PDF critical-value detection feasibility

Date: 2026-08-25
Scope: read-only review of the current HIS/LIS bridge and recent result files
Privacy: patient identifiers and names were not included in this report
Git: local workspace only; no commit or push

## Executive conclusion

The current system can support **OCR-assisted critical-value detection**, but it cannot safely create fully automatic critical alerts from the data currently returned by the LIS bridge.

The safest first release is:

1. retain the PDF as the official report;
2. extract candidate test/value/unit rows with server-side OCR;
3. compare the extracted rows with a hospital-approved, versioned critical-value rule table;
4. require a laboratory staff member to confirm the candidate before a critical alert is released.

A still safer and faster initial implementation is to require the laboratory uploader to select `Critical / Not critical` and enter the critical test, value, and unit when the PDF is uploaded. OCR can then be added as a prefill assistant.

## Current LIS bridge

The HIS currently reads two LIS tables through the Worker API:

- `lis_one_order_result_files`
- `lis_one_test_orders`

The complete fields available from `lis_one_order_result_files` are file metadata only: ID, order ID, filename, MIME type, size, storage path, uploader, and upload time.

The complete `lis_one_test_orders` schema includes order and patient context, test name, status, dates, notes, and tracking fields. It does **not** include atomic result value, unit, abnormal flag, critical flag, critical threshold, or structured interpretation.

For the order IDs associated with the 20 most recent result files:

- 82 order rows were returned;
- 0 had `completed_at`;
- 0 had `result_date`;
- 0 had `result_sent_by`;
- 0 had `note` or a critical-related term;
- 0 had `test_items`;
- all recent status samples remained `Pending`, even though result files existed.

Therefore the current order status and timestamps cannot be used as a reliable critical-result signal. The result file upload event and `uploaded_at` are currently the reliable indication that a report became available.

## Recent file sample

A read-only review of the 50 latest result-file metadata rows found:

| Format | Count | Size/profile |
|---|---:|---|
| PDF | 47 | Median 29.37 MB; 46 of 47 were larger than 10 MB |
| JPEG | 3 | Approximately 0.13 MB each |

Ten recent PDFs were downloaded to a temporary local inspection directory:

- 9 of 10 were image-only PDFs with no usable text layer;
- 1 of 10 contained an extractable text layer;
- the image-only PDFs used a consistent, high-resolution laboratory-report layout;
- the numerical reports visibly contained `Test item`, `Result`, `Unit`, `Flag`, and `Ref. Range` columns;
- visible flags were `H` and `L`, which mean outside the reference range and are not sufficient by themselves to classify a value as critical;
- no sampled report contained an explicit `Critical`, `Panic`, or `Alert` marker;
- JPEG results can be narrative pathology reports, so they require a separate report classifier and must not be forced through a numerical critical-value parser.

## OCR experiment

English OCR was run locally against five representative high-resolution report panels without printing patient identity or raw report content.

- OCR confidence ranged from approximately 74% to 81%;
- table/result content and numerical tokens were detected in all five samples;
- one detailed numerical page was checked against 13 visible test/value rows, and all 13 test labels and numerical values matched exactly in that limited sample;
- no critical/panic/alert wording was detected.

This proves that OCR extraction is technically feasible for the clean numerical report template. It does **not** prove that automatic clinical classification is safe across every report type, scan quality, unit, age group, or future template.

## Feasibility decision

| Capability | Current feasibility | Decision |
|---|---|---|
| Detect that a new result file exists | Available now | Use file upload metadata |
| Show HN/name/result-ready time | Available now | Use enriched order identity plus `uploaded_at` |
| Read text from all PDFs directly | Not available | Most PDFs are image-only |
| Extract rows with OCR | Feasible | Run asynchronously on the server |
| Treat `H`/`L` as critical | Unsafe | `H`/`L` only indicate abnormal values |
| Determine critical status from current API fields | Not possible | Atomic values and critical flags are absent |
| Automatically alert from OCR alone | Not safe yet | Require laboratory confirmation |
| Alert from a structured LIS critical flag | Recommended | Add structured metadata/API fields |

## Recommended processing pipeline

1. Receive the new PDF/JPEG file event.
2. Classify the report as numerical laboratory, qualitative laboratory, pathology narrative, or unsupported.
3. Extract the PDF text layer when present; otherwise run OCR server-side.
4. Verify HN and Order ID against the LIS order before processing values.
5. Extract test name/code, result, comparator (`<`/`>`), unit, H/L flag, and reference range.
6. Normalize test aliases and units.
7. Compare values with a versioned critical-value table approved by the laboratory director and clinicians, including applicable age, sex, specimen, and patient-group rules.
8. Reject or route to manual review when patient identity, test mapping, unit, decimal format, table alignment, or OCR confidence is uncertain.
9. Show the PDF and extracted candidate side by side to authorized laboratory staff.
10. Create the persistent critical alert only after confirmation.
11. Store the PDF hash, extracted text/rows, OCR confidence, rule version, reviewer, confirmation time, recipients, acknowledgements, and escalation history.

## Performance note

Because almost all sampled PDFs were about 29.37 MB and image-only, downloading and OCR-processing them in each browser would be slow and waste bandwidth. OCR should run once in a Worker/server/background job, store the structured extraction, and let HIS clients read the small structured result. The original PDF remains the source document.

## Minimum database addition

At minimum, store structured confirmation separately from the PDF:

- `result_file_id`
- `order_id`
- `patient_id`
- `is_critical`
- `critical_items_json`
- `extraction_method`
- `ocr_confidence`
- `rule_version`
- `verified_by`
- `verified_at`
- `alert_status`

The PDF must remain accessible from the critical alert for verification.

## Final recommendation

Proceed with a two-stage design:

1. **Stage 1:** laboratory-confirmed critical flag and structured critical item entry at PDF upload time;
2. **Stage 2:** server-side OCR that prefills candidate rows and highlights possible critical values for laboratory confirmation.

Do not release an unattended automatic critical alert based only on the current PDFs until a larger, representative validation set has demonstrated safe performance for every supported report template and the hospital has approved the critical thresholds.
