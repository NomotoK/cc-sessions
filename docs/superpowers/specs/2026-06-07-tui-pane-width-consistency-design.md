# TUI Pane Width Consistency Design

Date: 2026-06-07
Status: Approved for planning

## Context

The previous TUI layout stability work introduced adaptive pane width
calculation, fixed project count columns, fixed session timestamp columns, and
display-width-aware filler for highlighted rows.

Small terminal windows still expose a layout mismatch. When the terminal width
is below roughly 183 columns, the session title area can visually overlap the
timestamp area, and the selected-row highlight can appear as two separated
segments: one under the session title and one under the timestamp. Project names
can also visually collide with the count column.

The likely cause is not the truncation algorithm itself. `app.tsx` computes a
`sessionPaneWidth`, but the right-side Ink container still uses flexible growth
instead of an explicit width. `SessionList` then calculates its internal label
column from a width value that may not match the width Yoga/Ink actually gives
to the pane.

## Decision

Use one width source of truth for each top-level pane and apply it explicitly to
the pane container and child components.

The top-level layout remains pane-first:

```text
[ ProjectPane ][ SessionPane ]
```

In `app.tsx`, terminal width is split into two explicit pane widths:

```text
projectPaneWidth = calculateProjectPaneWidth(terminalColumns)
sessionPaneWidth = terminalColumns - projectPaneWidth
```

Both panes should receive explicit widths:

```text
ProjectPane width = projectPaneWidth
SessionPane width = sessionPaneWidth
```

The right-side pane container, `SearchBar`, and `SessionList` must all use the
same `sessionPaneWidth`. This makes the actual Ink layout width match the width
used for row-internal truncation and highlight filler.

## Compression Policy

Use balanced compression.

The project pane should keep its existing minimum width and adaptive behavior
instead of shrinking aggressively to give all available space to the session
pane. The session pane then truncates session labels within its real available
width while preserving the fixed timestamp column.

This means small windows should prefer predictable clipping over overlap:

- Project names truncate before they overlap project counts.
- Session labels truncate before they overlap timestamps.
- Timestamps remain visible in their fixed column.
- Highlight filler never extends beyond the actual label column.

## App Layout

`app.tsx` should make the row container width explicit:

```tsx
<Box flexDirection="row" width={terminalColumns}>
  <ProjectList width={projectPaneWidth} ... />
  <Box flexDirection="column" width={sessionPaneWidth}>
    <SearchBar width={sessionPaneWidth} ... />
    <SessionList width={sessionPaneWidth} ... />
  </Box>
</Box>
```

Implementation may use equivalent JSX, but these semantics are required:

- The horizontal pane container has an explicit terminal width.
- The horizontal pane container does not use `flexGrow={1}`. Once
  `width={terminalColumns}` is set, `flexGrow` is redundant and weakens the
  "explicit width" contract.
- The project pane width is explicit.
- The session pane width is explicit.
- The session pane children use that same explicit width.

Use `stdout.columns` as `terminalColumns` without subtracting one column by
default. The current layout has no horizontal border or margin around the main
pane row, so the full terminal column count is the correct source of truth. If a
specific terminal renderer later proves it reports one extra usable column, that
should be handled as a verified compatibility fix, not as a speculative
`columns - 1` rule.

## Project Pane

`ProjectList` should keep the current fixed-column row design:

```text
[ project label column ][ count column ]
```

Requirements:

- The `ProjectList` root width equals the `width` prop.
- Each project row width equals the `width` prop.
- The count column keeps its fixed width and text-owned padding.
- The project label column uses the remaining width.
- Display-width-aware filler must not exceed the project label column width.
- Implementation should use the `width` prop directly for root and row widths.
  A local alias such as `paneWidth` is acceptable, but avoid misleading names
  such as `COLUMN_WIDTH` for the full pane width.

This preserves the previous fix that avoids false ellipses on short highlighted
project names.

## Session Pane

`SessionList` should keep the fixed-column row design:

```text
[ session label column ][ timestamp column ]
```

Requirements:

- The `SessionList` root width equals the `width` prop.
- The empty-session branch also renders with `width={width}` instead of
  `flexGrow={1}`.
- Each session row width equals the `width` prop.
- The timestamp column remains fixed at 12 columns and does not shrink.
- The session label column width is calculated from the real pane width:

```text
labelColumnWidth = width - timestampColumnWidth
```

- Long session labels truncate inside the label column.
- Highlight filler uses the label column width and must not exceed it.
- Session rows continue to show timestamp only, not file size.
- Active sessions continue to use green background and no trailing marker.
- Row-state priority remains:

```text
deleting red > selected cyan > active green > normal
```

## Search Bar

`SearchBar` currently has no width prop. It should accept an explicit `width`
prop from `app.tsx` and render within the same session pane width.

Requirements:

- The `SearchBar` root width equals `sessionPaneWidth`.
- Header text must not force the session pane wider than `sessionPaneWidth`.
- When the current project name or search prompt is too long, it should truncate
  instead of widening the pane.
- Truncation should use Ink's layout behavior, not a second manual string
  truncation algorithm.
- The root `Box` uses `width={width}`.
- The project-name segment is rendered inside a bounded flex child with
  `overflowX="hidden"` and `Text wrap="truncate"`.
- The inactive prompt/query segment is rendered inside a bounded flex child with
  `overflowX="hidden"` and `Text wrap="truncate"`.

Search input behavior is not otherwise redesigned.

## Extreme Narrow Terminals

The normal supported lower bound for this design is:

```text
PROJECT_PANE_MIN_WIDTH + SESSION_PANE_MIN_WIDTH = 68 columns
```

At 68 columns and above, the balanced compression rules apply. Below 68 columns,
this design does not introduce a focus-only mode or preview-style pane collapse.
The app should still avoid throwing, but fully readable two-pane layout is not a
goal for this change. If sub-68-column support becomes important, it should be a
separate design for narrow-terminal degradation.

## Files Changed

Expected implementation scope:

- `src/app.tsx`
  - Set the horizontal pane row to `width={terminalColumns}` and remove
    redundant `flexGrow={1}` from that row.
  - Set the right-side session pane container to `width={sessionPaneWidth}`.
  - Pass `width={sessionPaneWidth}` to both `SearchBar` and `SessionList`.
- `src/components/SearchBar.tsx`
  - Add a required `width` prop.
  - Apply that width to the root `Box`.
  - Use `Text wrap="truncate"` for long project names and inactive prompt text
    so the header cannot widen the session pane.
- `src/components/SessionList.tsx`
  - Ensure the root and empty-session branch use `width={width}`.
  - Ensure each session row uses `width={width}`.
  - Continue deriving the label column width from `width - 12`.
- `src/components/ProjectList.tsx`
  - Keep root and row widths tied directly to the `width` prop; only naming or
    clarity adjustments are expected here.
- Tests under `__tests__/components/` and `__tests__/utils/`
  - Add or update focused tests for pane width consistency, `SearchBar` width
    behavior, and small-window row width contracts.

## Testing

Add or update tests for small-window width consistency:

- Layout helper or app-level tests cover widths around the problem range, such
  as 120, 160, and 183 columns.
- The computed widths satisfy:

```text
projectPaneWidth + sessionPaneWidth = terminalColumns
```

- `ProjectList` root and row widths equal the passed width.
- `SessionList` root and row widths equal the passed width.
- `SessionList` empty state uses the passed width.
- `SessionList` label width derives from `width - 12`.
- `SearchBar` accepts and applies `width`.
- `SearchBar` uses `wrap="truncate"` for long project names and inactive prompt
  text inside the bounded header.
- A small-window session row keeps the timestamp in the fixed timestamp column
  while the label column uses truncation/filler within its own width.

Existing tests for display width, CJK labels, active row styling, timestamp-only
metadata, and row-state priority should continue to pass.

## Non-Goals

This design does not add a preview pane.
This design does not change keyboard shortcuts.
This design does not change scanning, parsing, deletion, or resume behavior.
This design does not reintroduce file size into the TUI session row.
