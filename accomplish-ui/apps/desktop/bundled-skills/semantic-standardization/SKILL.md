---
name: semantic-standardization
description: 'Standardize non-uniform part names, descriptions, and item codes across BOM data using semantic matching and canonical mapping for consistent SRIM records.'
command: /semantic-standardization
verified: true
---

# Skill: Semantic Standardization

## Description

Detects and resolves inconsistent or non-uniform part descriptions, item names, and codes across BOM datasets. Uses semantic matching to map variations to canonical SRIM terms, ensuring clean and consistent records.

---

## Trigger

Use this skill whenever the user asks to:

- Standardize part names or descriptions in a BOM
- Normalize item codes or vendor names
- Detect duplicate items with different naming conventions
- Clean up inconsistent terminology across multiple BOMs
- Map local/supplier names to SRIM canonical names

---

## Parameters

- `dataset` – The BOM records to standardize (from File Upload and Scan or direct input)
- `field` – Field(s) to standardize: `description`, `part_no`, `supplier`, or `all`
- `canonical_map` _(optional)_ – Reference mapping file if a custom glossary is provided
- `threshold` _(optional)_ – Similarity threshold for fuzzy matching (default: 85%)

---

## Steps

### STEP 1 — Load Dataset

```
Accept records from:
  - Output of File Upload and Scan skill
  - Direct user input
  - Existing SRIM BOM table
```

### STEP 2 — Detect Variations

```
For each target field:
  → Tokenize and normalize text (lowercase, strip symbols)
  → Group records with similarity > threshold
  → Flag groups with more than one distinct form for the same item
```

### STEP 3 — Resolve Canonical Form

```
For each flagged group:
  1. Check canonical_map if provided → use mapped value
  2. Check SRIM master item list → match to existing canonical name
  3. If no match: surface to user with top suggestions
     Example:
       Variants: ["BOLT M8 SS", "M8 Stainless Bolt", "Bolt 8mm SS"]
       Suggested canonical: "BOLT M8 STAINLESS STEEL"
```

### STEP 4 — Apply Standardization

```
For each resolved record:
  → Replace variant text with canonical form
  → Log original → canonical mapping for audit trail
  → Mark record as "standardized"
```

### STEP 5 — Review and Confirm

```
Present summary to user:
  - Total records processed
  - Records standardized (count and %)
  - Records requiring manual review
  - Sample of changes (original → canonical)

Ask for confirmation before saving.
```

### STEP 6 — Output

```
Return standardized dataset ready for:
  - Consolidation of BOM
  - Direct SRIM import
  - Export as cleaned Excel/CSV
```

---

## Security Rules

- NEVER modify source records without showing a preview and getting user confirmation
- ALWAYS preserve the original values in an audit log column
- Flag ambiguous mappings for user review rather than auto-applying
