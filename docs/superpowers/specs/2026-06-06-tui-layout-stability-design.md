# TUI Layout Stability Design

Date: 2026-06-06
Status: Approved for planning

## Context

The current `cc-sessions` TUI uses a two-pane layout:

```text
[ ProjectList ] [ SessionList ]
```

The visual structure is correct, but long project names and long session labels
can force adjacent text onto a new line. This causes four user-visible layout
problems:

1. Long project names consume too much horizontal space.
2. Project session counts can wrap to the next line.
3. Long session labels can wrap and disrupt the session list.
4. Session timestamps can be pushed onto the next line.

The layout needs to stay compact and predictable now, while leaving a clean path
for a future yazi-like preview pane.

## Decision

Use a pane-first layout with fixed columns inside each row.

Current top-level layout remains:

```text
[ ProjectPane ] [ SessionPane ]
```

Future preview support can extend this to:

```text
[ ProjectPane ] [ SessionPane ] [ PreviewPane ]
```

Project counts and session timestamps should not become separate top-level
containers. They are fixed-width columns inside their owning pane. This keeps
scrolling, selection, focus, deletion highlighting, and future pane navigation
localized to each pane.

## Project Pane

The project pane should use an adaptive width derived from terminal width:

```text
projectPaneWidth = clamp(20, floor(terminalWidth * 0.28), 32)
```

The exact constants can be adjusted during implementation, but the behavior must
follow these rules:

- The project pane has a minimum width so names remain recognizable.
- The project pane has a maximum width so it does not starve the session pane.
- The session pane keeps a minimum readable width on narrow terminals.

Each project row is rendered as two columns:

```text
[ prefix + project name, flexible, truncate ] [ count, fixed, right-aligned ]
```

Example:

```text
> accounting-agent     (31)
  long-project-nam...  (12)
```

The count column must never wrap or be pushed to the next line. Long project
names truncate with an ellipsis.

## Session Pane

Each session row is rendered as two columns:

```text
[ icon + label, flexible, truncate ] [ timestamp/meta, fixed, right-aligned ]
```

Example:

```text
* 自我介绍和选择企业修改                         06-06 18:48
  <command-message>claude-hud:configure...       06-06 17:00
# Check state machine rollback support           05-29 14:05
```

The timestamp/meta column must have a fixed width and must not shrink. The label
column uses the remaining width and truncates instead of wrapping.

If the UI continues to show both timestamp and size, the fixed meta column must
reserve enough width for the longest supported meta format. If the UI only shows
timestamp, the column can be narrower.

## Component Boundaries

The implementation should preserve the current pane ownership model:

- `ProjectList` remains responsible for project scrolling, selection, focus, and
  project deletion highlight.
- `SessionList` remains responsible for session scrolling, selection, focus, and
  session deletion highlight.
- Row-level layout can be extracted into small row components, such as
  `ProjectRow` and `SessionRow`, if that keeps the list components easier to
  read.
- Width calculation should live in `app.tsx` or a small layout helper so future
  `PreviewPane` support does not require scattered width logic.

The layout should rely primarily on Ink layout behavior:

- Use `Box` widths, `flexGrow`, and `flexShrink={0}` to define column behavior.
- Use `Text wrap="truncate"` for text that must remain on one line.
- Avoid relying on manual string-length truncation as the main alignment
  mechanism.

Manual truncation may remain as a fallback where a hard character limit is
useful, but column width should be the source of truth for visual alignment.

## Future Preview Pane

This design intentionally avoids four top-level containers because future preview
support is pane-oriented:

```text
[ ProjectPane ] [ SessionPane ] [ PreviewPane ]
```

Expected future behavior:

- Wide terminals can show all three panes.
- Medium terminals can show project and session panes, with preview accessible
  through a shortcut or focus mode.
- Narrow terminals can degrade to the focused pane.

Keeping counts and timestamps inside their owning panes avoids row alignment
problems when preview mode introduces new scrolling and focus states.

## Testing

Add focused tests for layout stability:

- Long project names do not cause session counts to wrap.
- Long session labels do not cause timestamps to wrap.
- Narrow terminal widths keep the session pane readable.
- Wide terminal widths do not let the project pane grow without bound.

The tests can be component-rendering tests or snapshot-style tests using Ink's
test utilities, depending on what fits the existing test setup.

## Non-Goals

This design does not add session preview functionality.
This design does not change scanner, parser, deleter, or resume behavior.
This design does not redesign keyboard shortcuts.
