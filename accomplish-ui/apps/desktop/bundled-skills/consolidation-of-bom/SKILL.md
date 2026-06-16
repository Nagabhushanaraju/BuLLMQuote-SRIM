---
name: consolidation-of-bom
description: 'Merge and deduplicate Bill of Materials from multiple sources or suppliers into a single unified SRIM BOM, resolving conflicts and aggregating quantities.'
command: /consolidation-of-bom
verified: true
---

# Skill: Consolidation of BOM

## Description

Merges multiple Bill of Materials (BOM) files from different sources, projects, or suppliers into a single unified BOM. Handles deduplication, quantity aggregation, conflict resolution, and produces a clean consolidated output ready for SRIM import.

---

## Trigger

Use this skill whenever the user asks to:

- Merge two or more BOMs into one
- Consolidate BOMs from multiple suppliers or projects
- Deduplicate items across BOM files
- Aggregate quantities for the same part across multiple BOMs
- Produce a master BOM from sub-BOMs

---

## Parameters

- `bom_sources` – List of BOM datasets to merge (from File Upload and Scan or direct input)
- `merge_key` – Field used to match items across BOMs (default: `part_no`)
- `conflict_resolution` – Strategy for conflicting values: `prefer_first`, `prefer_latest`, `ask_user` (default: `ask_user`)
- `aggregate_qty` – Whether to sum quantities for duplicate items (default: `true`)

---

## Steps

### STEP 1 — Load Source BOMs

```
Accept 2 or more BOM datasets.
Verify each has at minimum: part_no, description, quantity.
Report source counts:
  BOM 1: N items
  BOM 2: N items
  ...
```

### STEP 2 — Normalize Keys

```
Apply merge_key field across all sources:
  → Trim and uppercase part_no values
  → Run semantic standardization if descriptions are non-uniform
  → Build index: part_no → [list of records across sources]
```

### STEP 3 — Identify Duplicates

```
Group all records by merge_key.
For each group with > 1 record:
  - Same part_no, same description → DUPLICATE (merge)
  - Same part_no, different description → CONFLICT (flag)
  - Different part_no, similar description → POTENTIAL DUPLICATE (flag)
```

### STEP 4 — Resolve Conflicts

```
For DUPLICATE groups:
  → If aggregate_qty = true: sum quantities across all sources
  → Pick description from first source (or user-specified)
  → Merge additional attributes (unit, supplier, price) using conflict_resolution strategy

For CONFLICT groups:
  → If conflict_resolution = 'ask_user': present to user with options
  → If 'prefer_first': keep record from BOM 1
  → If 'prefer_latest': keep record from most recently added BOM

For POTENTIAL DUPLICATES:
  → Always surface to user for manual decision
```

### STEP 5 — Build Consolidated BOM

```
Produce unified record set:
  - One row per unique part_no
  - Aggregated / resolved values
  - Source reference column: which BOM(s) the item came from
  - Quantity per source breakdown (optional audit column)
```

### STEP 6 — Summary Report

```
Present to user:
  Total unique items in consolidated BOM
  Items merged from multiple sources (with quantity roll-up)
  Conflicts resolved
  Items requiring manual review

Show preview table of first 10 rows.
Ask for confirmation before finalizing.
```

### STEP 7 — Output

```
Deliver consolidated BOM as:
  - In-app table for review
  - Downloadable Excel / CSV
  - Ready for SRIM master BOM import
```

---

## Security Rules

- NEVER silently overwrite conflicting data — always surface conflicts to the user
- ALWAYS include a source-reference column in the output for traceability
- NEVER finalize without user confirmation of the summary
