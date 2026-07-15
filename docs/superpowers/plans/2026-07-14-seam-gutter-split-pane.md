# Seam Gutter Split Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the extra overlay resizer with two embedded, functional seam gutters that resize three independent workspace panes without collapsing them.

**Architecture:** `App.tsx` owns two pane-boundary ratios and renders each divider as a real grid gutter. Pointer dragging updates the adjacent pane ratio through a shared helper; CSS provides the quiet gutter, hover grip, focus state, and pane separation. Existing appearance tokens remain the source of surface and text colors.

**Tech Stack:** React, TypeScript, Tailwind CSS, CSS custom properties, Vite.

## Global Constraints

- No minus buttons, collapse controls, or shrinking-to-rail behavior.
- The grip must be part of the boundary between panes, not a separate line layered over content.
- All three panes remain visible and have independent minimum widths.
- Resize interaction must support pointer drag, keyboard focus, and reduced-motion styling.
- Theme surfaces and text must continue using semantic appearance tokens.

---

### Task 1: Replace overlay splitter state with pane ratios

**Files:**
- Modify: `accomplish-ui/apps/web/src/client/App.tsx`

**Interfaces:**
- Consumes: existing pane JSX and pointer event handling.
- Produces: `paneRatios`, `handleSplitterPointerDown`, and ratio-based `gridTemplateColumns`.

- [x] **Step 1: Remove dead rail refs and fixed-third proximity math.**
- [x] **Step 2: Add two bounded ratios initialized to `30/40/30`.**
- [x] **Step 3: Update ratios from pointer movement relative to the wrapper width.**
- [x] **Step 4: Render each gutter in the grid flow and keep all panes visible.**
- [x] **Step 5: Run the TypeScript/Vite build.**

### Task 2: Style the seam gutters and independent panes

**Files:**
- Modify: `accomplish-ui/apps/web/src/client/styles/appearance.css`

**Interfaces:**
- Consumes: gutter class names from `App.tsx`.
- Produces: embedded seam grip visuals, hover/focus states, pane separation, and reduced-motion behavior.

- [x] **Step 1: Replace absolute splitter styles with grid-gutter styles.**
- [x] **Step 2: Make the grip centered in the gutter and visible on hover/focus.**
- [x] **Step 3: Preserve clear separation in light and dark themes.**
- [x] **Step 4: Run the Vite build and inspect the running page.**

### Task 3: Verify interaction and theme consistency

**Files:**
- Verify: `accomplish-ui/apps/web/src/client/App.tsx`
- Verify: `accomplish-ui/apps/web/src/client/styles/appearance.css`

- [x] **Step 1: Confirm no collapse state or minus control remains.**
- [x] **Step 2: Confirm each gutter has an accessible label and keyboard focus state.**
- [x] **Step 3: Confirm the build passes.**
- [x] **Step 4: Confirm the running app loads at `http://localhost:5180/`.**
