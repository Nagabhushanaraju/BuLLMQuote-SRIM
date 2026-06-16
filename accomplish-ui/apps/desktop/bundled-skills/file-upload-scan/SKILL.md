---
name: file-upload-scan
description: 'Upload and scan files (Excel, CSV, PDF) to extract BOM data, part numbers, specifications, and inventory records for SRIM processing.'
command: /file-upload-scan
verified: true
---

# Skill: File Upload and Scan

## Description

Handles uploading structured files (Excel, CSV, PDF) and scanning their contents to extract BOM items, part numbers, quantities, specifications, and supplier details for ingestion into the SRIM system.

---

## Trigger

Use this skill whenever the user asks to:

- Upload a file containing parts, BOM, or inventory data
- Scan a spreadsheet or PDF for item records
- Import data from an Excel or CSV file into SRIM
- Extract part numbers or specifications from a document

---

## Parameters

- `file_path` – Path or reference to the uploaded file
- `file_type` – Detected automatically: `excel`, `csv`, `pdf`
- `target_sheet` _(optional)_ – Sheet name in Excel files (defaults to first sheet)
- `columns` _(optional)_ – Specific column names to extract

---

## Steps

### STEP 1 — Detect File Type

```
Identify format from file extension or MIME type.
Supported: .xlsx, .xls, .csv, .pdf
Set file_type accordingly.
```

### STEP 2 — Open and Parse File

```
For Excel (.xlsx / .xls):
  → Read target_sheet or first sheet
  → Extract headers from row 1
  → Read all data rows

For CSV:
  → Detect delimiter (comma, semicolon, tab)
  → Parse headers and rows

For PDF:
  → Extract text layer
  → Identify table structures
  → Map to columns: part_no, description, qty, unit
```

### STEP 3 — Identify BOM Columns

```
Map detected columns to standard SRIM fields:
  - Part Number / Item Code → part_no
  - Description / Item Name → description
  - Quantity / Qty          → quantity
  - Unit / UOM              → unit
  - Supplier / Vendor       → supplier
  - Price / Rate            → unit_price
```

### STEP 4 — Validate Records

```
For each row:
  ✅ part_no is non-empty
  ✅ quantity is numeric and > 0
  ⚠️ Flag rows with missing mandatory fields
  ⚠️ Flag duplicate part numbers
```

### STEP 5 — Report Summary

```
Present to user:
  - Total records found
  - Valid records
  - Flagged / skipped rows (with reasons)
  - Preview of first 5 rows
Ask for confirmation before proceeding to import.
```

### STEP 6 — Hand Off to SRIM

```
Pass validated records to the next workflow step:
  - Semantic Standardization (if descriptions are non-uniform)
  - Consolidation of BOM (if merging with existing data)
  - Direct import (if data is already clean)
```

---

## Security Rules

- NEVER process files from untrusted or unverified sources without user confirmation
- NEVER overwrite existing SRIM data without explicit user approval
- Always show a preview before committing any import
