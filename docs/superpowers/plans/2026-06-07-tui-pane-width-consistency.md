# TUI Pane Width Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make small-window TUI layout use one explicit pane width source so project counts, session timestamps, and row highlights do not overlap or split.

**Architecture:** Keep the pane-first layout. Add a pure width split helper, apply explicit widths in `app.tsx`, and ensure `SearchBar`, `ProjectList`, and `SessionList` all render within the same pane width they use for truncation and highlight filler.

**Tech Stack:** TypeScript, React 18, Ink 5, Vitest, tsup.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `src/utils/layout.ts` | Add a pane width split helper that returns project/session widths from terminal columns. |
| `__tests__/utils/layout.test.ts` | Cover 120/160/183-column width splits and total-width invariants. |
| `src/components/SearchBar.tsx` | Add explicit `width` prop and bounded truncating header segments. |
| `__tests__/components/search-bar.test.tsx` | New component tests for SearchBar width and truncation props. |
| `src/app.tsx` | Apply explicit horizontal row width, explicit session pane width, and pass width to SearchBar/SessionList. |
| `src/components/SessionList.tsx` | Use explicit root, empty-state, and row widths from the `width` prop. |
| `__tests__/components/session-list.test.tsx` | Extend tests for root width, row width, empty-state width, and small-window timestamp preservation. |
| `src/components/ProjectList.tsx` | Rename the local pane-width alias for clarity; keep behavior intact. |
| `__tests__/components/project-list.test.tsx` | Keep existing root/row width tests passing. |

No scanner, parser, deleter, CLI, resume, or shortcut behavior changes are in scope.

---

### Task 1: Add Pane Width Split Helper

**Files:**
- Modify: `src/utils/layout.ts`
- Modify: `__tests__/utils/layout.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests to `__tests__/utils/layout.test.ts` after the existing `calculateProjectPaneWidth` tests:

```typescript
import { calculatePaneWidths } from '../../src/utils/layout.js';
```

If the import block already imports multiple symbols from `layout.js`, update it to:

```typescript
import {
  calculatePaneWidths,
  calculateProjectPaneWidth,
  fillToDisplayWidth,
  getDisplayWidth,
} from '../../src/utils/layout.js';
```

Add:

```typescript
describe('calculatePaneWidths', () => {
  it('splits a 120-column terminal into explicit project and session widths', () => {
    expect(calculatePaneWidths(120)).toEqual({
      projectPaneWidth: 32,
      sessionPaneWidth: 88,
    });
  });

  it('splits a 160-column terminal while keeping total width unchanged', () => {
    const widths = calculatePaneWidths(160);

    expect(widths).toEqual({
      projectPaneWidth: 32,
      sessionPaneWidth: 128,
    });
    expect(widths.projectPaneWidth + widths.sessionPaneWidth).toBe(160);
  });

  it('splits the observed 183-column threshold without losing columns', () => {
    const widths = calculatePaneWidths(183);

    expect(widths).toEqual({
      projectPaneWidth: 32,
      sessionPaneWidth: 151,
    });
    expect(widths.projectPaneWidth + widths.sessionPaneWidth).toBe(183);
  });

  it('keeps the session pane non-negative below the normal supported width', () => {
    expect(calculatePaneWidths(60)).toEqual({
      projectPaneWidth: 20,
      sessionPaneWidth: 40,
    });
  });

  it('uses the default terminal width when columns are unavailable', () => {
    expect(calculatePaneWidths(undefined)).toEqual({
      projectPaneWidth: 22,
      sessionPaneWidth: 58,
    });
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npm test -- __tests__/utils/layout.test.ts
```

Expected: FAIL because `calculatePaneWidths` is not exported.

- [ ] **Step 3: Implement the helper**

Add this interface and function to `src/utils/layout.ts` after `calculateProjectPaneWidth`:

```typescript
export interface PaneWidths {
  projectPaneWidth: number;
  sessionPaneWidth: number;
}

export function calculatePaneWidths(terminalColumns?: number): PaneWidths {
  const columns = terminalColumns && terminalColumns > 0
    ? terminalColumns
    : DEFAULT_TERMINAL_WIDTH;
  const projectPaneWidth = calculateProjectPaneWidth(columns);

  return {
    projectPaneWidth,
    sessionPaneWidth: Math.max(0, columns - projectPaneWidth),
  };
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm test -- __tests__/utils/layout.test.ts
```

Expected: PASS. Existing layout tests plus the new pane-width tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/utils/layout.ts __tests__/utils/layout.test.ts
git commit -m "feat(layout): 添加 Pane 宽度分配计算"
```

---

### Task 2: Add Explicit SearchBar Width

**Files:**
- Modify: `src/components/SearchBar.tsx`
- Modify: `src/app.tsx`
- Create: `__tests__/components/search-bar.test.tsx`

- [ ] **Step 1: Write the failing SearchBar tests**

Create `__tests__/components/search-bar.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import SearchBar from '../../src/components/SearchBar.js';

function flattenElements(children: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flattenElements(child.props.children);
    }

    return React.isValidElement(child) ? [child] : [];
  });
}

function renderSearchBar(overrides: Partial<React.ComponentProps<typeof SearchBar>> = {}) {
  return SearchBar({
    active: false,
    query: '',
    onQueryChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    projectName: 'accounting-agent-with-a-very-long-name',
    width: 40,
    ...overrides,
  });
}

describe('SearchBar layout', () => {
  it('applies the explicit session pane width to the root box', () => {
    const element = renderSearchBar({ width: 52 });

    expect(element.props.width).toBe(52);
  });

  it('bounds and truncates the project name segment', () => {
    const element = renderSearchBar();
    const children = flattenElements(element.props.children);
    const projectNameBox = children[1] as React.ReactElement;
    const projectNameText = React.Children.toArray(projectNameBox.props.children)[0] as React.ReactElement;

    expect(projectNameBox.props.flexGrow).toBe(1);
    expect(projectNameBox.props.overflowX).toBe('hidden');
    expect(projectNameText.props.wrap).toBe('truncate');
  });

  it('bounds and truncates inactive prompt text', () => {
    const element = renderSearchBar({ query: 'a very long search query that must stay bounded' });
    const children = flattenElements(element.props.children);
    const promptBox = children[3] as React.ReactElement;
    const promptText = React.Children.toArray(promptBox.props.children)[0] as React.ReactElement;

    expect(promptBox.props.width).toBe(18);
    expect(promptBox.props.overflowX).toBe('hidden');
    expect(promptText.props.wrap).toBe('truncate');
  });

  it('keeps active TextInput inside a bounded flex child', () => {
    const element = renderSearchBar({ active: true });
    const children = flattenElements(element.props.children);
    const inputBox = children[4] as React.ReactElement;

    expect(inputBox.props.flexGrow).toBe(1);
    expect(inputBox.props.overflowX).toBe('hidden');
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npm test -- __tests__/components/search-bar.test.tsx
```

Expected: FAIL because `SearchBar` does not yet accept `width` and does not render bounded segments.

- [ ] **Step 3: Implement bounded SearchBar layout**

Replace `src/components/SearchBar.tsx` with:

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface SearchBarProps {
  active: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  projectName: string;
  width: number;
}

const INACTIVE_PROMPT_WIDTH = 18;

export default function SearchBar({
  active,
  query,
  onQueryChange,
  onSubmit,
  onCancel,
  projectName,
  width,
}: SearchBarProps): React.ReactElement {
  return (
    <Box width={width}>
      <Text bold color="cyan">Sessions: </Text>
      <Box flexGrow={1} overflowX="hidden">
        <Text wrap="truncate" color="cyan">{projectName}</Text>
      </Box>
      <Text> </Text>
      {active ? (
        <>
          <Text>{'>'}</Text>
          <Box flexGrow={1} overflowX="hidden">
            <TextInput
              value={query}
              onChange={onQueryChange}
              onSubmit={onSubmit}
              placeholder="type to search..."
            />
          </Box>
        </>
      ) : (
        <Box width={INACTIVE_PROMPT_WIDTH} overflowX="hidden">
          <Text wrap="truncate" dimColor>{query || 'press / to search'}</Text>
        </Box>
      )}
    </Box>
  );
}
```

`onCancel` remains part of the prop contract because `app.tsx` passes it and future keyboard handling may use it; this task does not redesign search behavior.

- [ ] **Step 4: Run SearchBar tests**

Run:

```bash
npm test -- __tests__/components/search-bar.test.tsx
```

Expected: PASS, 4 tests passed.

- [ ] **Step 5: Pass the current session pane width to SearchBar**

In `src/app.tsx`, find the existing `SearchBar` render and add `width={sessionPaneWidth}`:

```tsx
          <SearchBar
            active={state.searchActive}
            query={state.searchQuery}
            onQueryChange={(q: string) => dispatch({ type: 'SET_SEARCH', query: q })}
            onSubmit={() => {
              // Search stays active; user browses filtered results
            }}
            onCancel={() => {
              dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
              dispatch({ type: 'SET_SEARCH', query: '' });
            }}
            projectName={currentProject?.name ?? ''}
            width={sessionPaneWidth}
          />
```

This uses the existing `sessionPaneWidth` variable. Task 3 will change how that variable is calculated and applied to the parent containers.

- [ ] **Step 6: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no output.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/components/SearchBar.tsx src/app.tsx __tests__/components/search-bar.test.tsx
git commit -m "feat(layout): 约束搜索栏宽度"
```

---

### Task 3: Apply Explicit Pane Widths In App

**Files:**
- Modify: `src/app.tsx`

- [ ] **Step 1: Update App to use the pane width helper**

Modify the layout import in `src/app.tsx`:

```typescript
import { calculatePaneWidths } from './utils/layout.js';
```

Remove the old `calculateProjectPaneWidth` import from the same file.

Replace the terminal size calculation block:

```typescript
  // ----- Terminal size calculations -----
  const terminalHeight = stdout?.rows ?? 24;
  const terminalColumns = stdout?.columns ?? 80;
  const { projectPaneWidth, sessionPaneWidth } = calculatePaneWidths(terminalColumns);
  const listHeight = Math.max(3, terminalHeight - 5); // 2 header + 3 footer
  const projectListHeight = listHeight - 1;
```

- [ ] **Step 2: Make the main pane row and session pane explicit-width containers**

In the render block of `src/app.tsx`, replace:

```tsx
      <Box flexDirection="row" flexGrow={1}>
```

with:

```tsx
      <Box flexDirection="row" width={terminalColumns}>
```

Replace:

```tsx
        <Box flexDirection="column" flexGrow={1}>
```

with:

```tsx
        <Box flexDirection="column" width={sessionPaneWidth}>
```

Keep the existing `SearchBar` width prop from Task 2:

```tsx
          <SearchBar
            active={state.searchActive}
            query={state.searchQuery}
            onQueryChange={(q: string) => dispatch({ type: 'SET_SEARCH', query: q })}
            onSubmit={() => {
              // Search stays active; user browses filtered results
            }}
            onCancel={() => {
              dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
              dispatch({ type: 'SET_SEARCH', query: '' });
            }}
            projectName={currentProject?.name ?? ''}
            width={sessionPaneWidth}
          />
```

`SessionList` already receives `width={sessionPaneWidth}` from the previous work; keep that prop.

- [ ] **Step 3: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no output.

- [ ] **Step 4: Run focused component tests**

Run:

```bash
npm test -- __tests__/components/search-bar.test.tsx __tests__/utils/layout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app.tsx
git commit -m "feat(layout): 显式应用左右 Pane 宽度"
```

---

### Task 4: Enforce SessionList Root And Row Widths

**Files:**
- Modify: `src/components/SessionList.tsx`
- Modify: `__tests__/components/session-list.test.tsx`

- [ ] **Step 1: Add failing tests for explicit SessionList widths**

In `__tests__/components/session-list.test.tsx`, add these tests inside `describe('SessionList layout', ...)`:

```tsx
  it('applies the explicit width to the SessionList root', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: false,
      visibleHeight: 5,
      deletingIndex: null,
      width: 40,
    });

    expect(element.props.width).toBe(40);
  });

  it('applies the explicit width to each session row', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: false,
      visibleHeight: 5,
      deletingIndex: null,
      width: 40,
    });

    const item = getSessionItem(element);

    expect(item.props.width).toBe(40);
  });

  it('applies the explicit width to the empty state', () => {
    const element = SessionList({
      sessions: [],
      selectedIndex: 0,
      isFocused: false,
      visibleHeight: 5,
      deletingIndex: null,
      width: 40,
    });

    expect(element.props.width).toBe(40);
  });

  it('fills highlighted label content to width minus timestamp column width', () => {
    const element = SessionList({
      sessions: [makeSession({ label: 'short' })],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 52,
    });

    const columns = getSessionColumns(element);
    const labelText = getColumnText(columns[0] as React.ReactElement);
    const labelParts = React.Children.toArray(labelText.props.children) as React.ReactElement[];
    const labelContent = React.Children.toArray(labelParts[1].props.children).join('');

    expect(labelContent).toBe(` short${' '.repeat(33)}`);
  });
```

The last test uses `width=52`, timestamp column `12`, label column `40`, icon `*`, and label content after the icon as `' short'` plus 33 spaces.

- [ ] **Step 2: Run the SessionList tests to verify they fail**

Run:

```bash
npm test -- __tests__/components/session-list.test.tsx
```

Expected: FAIL because the root, empty state, and rows do not yet have explicit `width` props.

- [ ] **Step 3: Implement explicit widths in SessionList**

In `src/components/SessionList.tsx`, change the empty-state branch:

```tsx
    return (
      <Box flexDirection="column" width={width}>
        <Text dimColor>No sessions</Text>
      </Box>
    );
```

Change the main root:

```tsx
    <Box flexDirection="column" width={width}>
```

Change each row:

```tsx
          <Box key={session.uuid} width={width}>
```

Keep:

```typescript
const labelColumnWidth = Math.max(0, width - TIMESTAMP_COLUMN_WIDTH);
```

- [ ] **Step 4: Run SessionList tests**

Run:

```bash
npm test -- __tests__/components/session-list.test.tsx
```

Expected: PASS. All existing and new SessionList tests pass.

- [ ] **Step 5: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no output.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/SessionList.tsx __tests__/components/session-list.test.tsx
git commit -m "fix(layout): 固定会话列表根与行宽度"
```

---

### Task 5: Clarify ProjectList Pane Width Naming

**Files:**
- Modify: `src/components/ProjectList.tsx`
- Modify: `__tests__/components/project-list.test.tsx`

- [ ] **Step 1: Add a small-window row width regression test**

In `__tests__/components/project-list.test.tsx`, add:

```tsx
  it('keeps project rows at the explicit pane width in small windows', () => {
    const element = ProjectList({
      projects: shortProjects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 20,
    });

    const item = getProjectItem(element);

    expect(element.props.width).toBe(20);
    expect(item.props.width).toBe(20);
  });
```

- [ ] **Step 2: Run ProjectList tests**

Run:

```bash
npm test -- __tests__/components/project-list.test.tsx
```

Expected: PASS or FAIL only if the existing implementation does not expose the row width as expected.

- [ ] **Step 3: Rename misleading local width alias**

In `src/components/ProjectList.tsx`, replace:

```typescript
const COLUMN_WIDTH = width;
```

with:

```typescript
const paneWidth = width;
```

Then replace every `COLUMN_WIDTH` reference in this file with `paneWidth`:

```tsx
<Box flexDirection="column" width={paneWidth}>
...
const nameColumnWidth = Math.max(0, paneWidth - COUNT_COLUMN_WIDTH);
...
<Box key={project.encodedPath} width={paneWidth}>
```

- [ ] **Step 4: Run ProjectList tests**

Run:

```bash
npm test -- __tests__/components/project-list.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no output.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/ProjectList.tsx __tests__/components/project-list.test.tsx
git commit -m "refactor(layout): 澄清项目栏宽度命名"
```

---

### Task 6: Full Verification

**Files:**
- Verify only; no required source edits.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS. All core, utility, and component tests pass.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no output.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS. `tsup` builds `dist/main.js` successfully.

- [ ] **Step 4: Run non-interactive smoke test**

Run:

```bash
node dist/main.js list
```

Expected: PASS. Command exits 0 and prints a JSON array or `[]`.

- [ ] **Step 5: Inspect final status**

Run:

```bash
git diff --stat HEAD
git status --short
```

Expected: no tracked file changes. If unrelated untracked files appear, do not stage them unless the user explicitly asks.

- [ ] **Step 6: Commit cleanup only if needed**

If verification required fixes, commit only intentional files:

```bash
git add src __tests__
git commit -m "test(layout): 验证 Pane 宽度一致性"
```

If verification made no file changes, do not create an empty commit.

---

## Plan Self-Review

Spec coverage:

- Explicit pane width split: Task 1 and Task 3.
- Main row `width={terminalColumns}` and no `flexGrow={1}`: Task 3.
- Session pane container explicit `width={sessionPaneWidth}`: Task 3.
- SearchBar width prop and truncating bounded segments: Task 2 and Task 3.
- SessionList root, row, and empty-state widths: Task 4.
- ProjectList width naming and row-width regression: Task 5.
- Extreme narrow terminals: Task 1 verifies non-negative width; no pane collapse is added.
- Existing timestamp-only, active row, CJK, and priority behavior remains covered by existing tests and Task 6.

Placeholder scan:

- The plan contains no TBD/TODO placeholders.
- Every code-changing step includes concrete code or exact replacements.
- Every verification step includes commands and expected results.

Type consistency:

- `calculatePaneWidths()` returns `{ projectPaneWidth, sessionPaneWidth }` and is consumed by `app.tsx`.
- `SearchBarProps.width` is introduced before `app.tsx` passes it.
- `SessionListProps.width` already exists and is reused.
