# TUI Layout Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the `cc-sessions` TUI layout so project counts and session timestamps stay on one line while long project names and session labels truncate cleanly.

**Architecture:** Keep the current pane-first structure: `ProjectList` owns the project pane and `SessionList` owns the session pane. Add a small layout helper for terminal-width-derived pane widths, then make each list row use fixed internal columns instead of `justifyContent="space-between"` or string-length-driven alignment.

**Tech Stack:** TypeScript, React 18, Ink 5, Vitest, tsup.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `src/utils/layout.ts` | Pure layout constants and width calculation helpers for adaptive pane sizing. |
| `__tests__/utils/layout.test.ts` | TDD coverage for pane width calculation across narrow, normal, and wide terminals. |
| `src/components/ProjectList.tsx` | Render project pane with adaptive width and row-internal name/count columns. |
| `src/components/SessionList.tsx` | Render session pane with fixed timestamp column, truncating label column, and active-row background. |
| `__tests__/components/project-list.test.tsx` | Component structure tests for project rows: fixed count column, truncating name column, no hard-coded pane width. |
| `__tests__/components/session-list.test.tsx` | Component structure tests for session rows: fixed timestamp column, truncating label column, no size in meta, active background, CJK label coverage. |
| `src/app.tsx` | Compute adaptive project pane width from `stdout.columns` and pass it to `ProjectList`. |

No scanner, parser, deleter, CLI, or resume behavior changes are in scope.

---

### Task 1: Add Layout Width Helper

**Files:**
- Create: `src/utils/layout.ts`
- Create: `__tests__/utils/layout.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/utils/layout.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { calculateProjectPaneWidth } from '../../src/utils/layout.js';

describe('calculateProjectPaneWidth', () => {
  it('uses the minimum width on narrow terminals', () => {
    expect(calculateProjectPaneWidth(60)).toBe(20);
  });

  it('uses 28 percent of terminal width when within bounds', () => {
    expect(calculateProjectPaneWidth(100)).toBe(28);
  });

  it('uses the maximum width on wide terminals', () => {
    expect(calculateProjectPaneWidth(160)).toBe(32);
  });

  it('keeps at least 48 columns available for the session pane', () => {
    expect(calculateProjectPaneWidth(68)).toBe(20);
    expect(calculateProjectPaneWidth(72)).toBe(20);
  });

  it('falls back to a normal terminal width when stdout columns are unavailable', () => {
    expect(calculateProjectPaneWidth(undefined)).toBe(22);
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npm test -- __tests__/utils/layout.test.ts
```

Expected: FAIL because `src/utils/layout.ts` does not exist.

- [ ] **Step 3: Implement the layout helper**

Create `src/utils/layout.ts`:

```typescript
export const PROJECT_PANE_MIN_WIDTH = 20;
export const PROJECT_PANE_MAX_WIDTH = 32;
export const PROJECT_PANE_RATIO = 0.28;
export const SESSION_PANE_MIN_WIDTH = 48;
export const DEFAULT_TERMINAL_WIDTH = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateProjectPaneWidth(terminalColumns?: number): number {
  const columns = terminalColumns && terminalColumns > 0
    ? terminalColumns
    : DEFAULT_TERMINAL_WIDTH;

  const preferred = Math.floor(columns * PROJECT_PANE_RATIO);
  const maxAllowedBySessionPane = Math.max(
    PROJECT_PANE_MIN_WIDTH,
    columns - SESSION_PANE_MIN_WIDTH,
  );

  return clamp(
    preferred,
    PROJECT_PANE_MIN_WIDTH,
    Math.min(PROJECT_PANE_MAX_WIDTH, maxAllowedBySessionPane),
  );
}
```

- [ ] **Step 4: Run the layout helper tests**

Run:

```bash
npm test -- __tests__/utils/layout.test.ts
```

Expected: PASS, 5 tests passed.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/utils/layout.ts __tests__/utils/layout.test.ts
git commit -m "feat(layout): 添加 TUI 自适应宽度计算"
```

---

### Task 2: Pass Adaptive Project Pane Width From App

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/components/ProjectList.tsx`

- [ ] **Step 1: Add a required `width` prop to `ProjectList`**

Modify `src/components/ProjectList.tsx` props near the top:

```typescript
interface ProjectListProps {
  projects: Project[];
  selectedIndex: number;
  isFocused: boolean;
  visibleHeight: number;
  deletingIndex: number | null;
  width: number;
}
```

Modify the function parameter list:

```typescript
export default function ProjectList({
  projects,
  selectedIndex,
  isFocused,
  visibleHeight,
  deletingIndex,
  width,
}: ProjectListProps): React.ReactElement {
```

Replace the hard-coded constant:

```typescript
const COLUMN_WIDTH = width;
```

- [ ] **Step 2: Run TypeScript to verify the missing prop error**

Run:

```bash
npx tsc --noEmit
```

Expected: FAIL because `src/app.tsx` calls `ProjectList` without the new `width` prop.

- [ ] **Step 3: Compute width in `app.tsx` and pass it down**

Modify imports in `src/app.tsx`:

```typescript
import { calculateProjectPaneWidth } from './utils/layout.js';
```

Modify the height calculation block in `src/app.tsx`:

```typescript
  // ----- Terminal size calculations -----
  const terminalHeight = stdout?.rows ?? 24;
  const terminalColumns = stdout?.columns ?? 80;
  const projectPaneWidth = calculateProjectPaneWidth(terminalColumns);
  const listHeight = Math.max(3, terminalHeight - 5); // 2 header + 3 footer
  const projectListHeight = listHeight - 1;
```

Pass the prop to `ProjectList`:

```tsx
        <ProjectList
          projects={state.projects}
          selectedIndex={state.selectedProjectIndex}
          isFocused={state.focusedPane === 'project'}
          visibleHeight={projectListHeight}
          deletingIndex={projectDeletingIndex}
          width={projectPaneWidth}
        />
```

- [ ] **Step 4: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no output.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app.tsx src/components/ProjectList.tsx
git commit -m "feat(layout): 从 App 传递项目栏自适应宽度"
```

---

### Task 3: Stabilize Project Row Columns

**Files:**
- Modify: `src/components/ProjectList.tsx`
- Create: `__tests__/components/project-list.test.tsx`

- [ ] **Step 1: Write failing component structure tests**

Create directory `__tests__/components` if it does not exist.

Create `__tests__/components/project-list.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import ProjectList from '../../src/components/ProjectList.js';
import type { Project } from '../../src/core/types.js';

const projects: Project[] = [
  {
    name: 'accounting-agent-with-a-very-long-name',
    encodedPath: '-Users-test-accounting-agent-with-a-very-long-name',
    fullPath: '/tmp/accounting-agent-with-a-very-long-name',
    sessionCount: 31,
    totalSize: 1000,
  },
];

function getProjectItem(element: React.ReactElement): React.ReactElement {
  const rootChildren = React.Children.toArray(element.props.children) as React.ReactElement[];
  return rootChildren[2] as React.ReactElement;
}

describe('ProjectList layout', () => {
  it('uses the width passed from App for the project pane', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    expect(element.props.width).toBe(22);
  });

  it('renders project name and count as separate fixed columns', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const item = getProjectItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];

    expect(columns).toHaveLength(2);
    expect(columns[0].props.flexGrow).toBe(1);
    expect(columns[0].props.overflowX).toBe('hidden');
    expect(columns[1].props.width).toBe(6);
    expect(columns[1].props.flexShrink).toBe(0);
  });

  it('truncates the project name text instead of wrapping', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const item = getProjectItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];
    const nameColumn = columns[0] as React.ReactElement;
    const nameText = React.Children.toArray(nameColumn.props.children)[0] as React.ReactElement;

    expect(nameText.props.wrap).toBe('truncate');
  });
});
```

- [ ] **Step 2: Run the new component tests to verify failure**

Run:

```bash
npm test -- __tests__/components/project-list.test.tsx
```

Expected: FAIL because the current project row renders `Text` siblings directly, not fixed row columns.

- [ ] **Step 3: Replace project row rendering with fixed columns**

Modify `src/components/ProjectList.tsx`.

Remove the old `truncate()` helper and replace it with these constants:

```typescript
const COUNT_COLUMN_WIDTH = 6;
```

Inside `ProjectList`, keep:

```typescript
  const COLUMN_WIDTH = width;
```

Replace the row body in `visibleProjects.map(...)` with:

```tsx
        const prefix = isSelected && isFocused ? '> ' : '  ';
        const countStr = `(${project.sessionCount})`;
        const selectedBg = isSelected && isFocused ? 'cyan' : undefined;
        const selectedFg = isSelected && isFocused ? 'black' : undefined;
        const deletingBg = isDeleting ? 'red' : selectedBg;
        const deletingFg = isDeleting ? 'white' : selectedFg;

        return (
          <Box key={project.encodedPath} width={COLUMN_WIDTH}>
            <Box flexGrow={1} overflowX="hidden">
              <Text
                wrap="truncate"
                color={deletingFg}
                backgroundColor={deletingBg}
                bold={isDeleting}
              >
                {prefix}{project.name}
              </Text>
            </Box>
            <Box width={COUNT_COLUMN_WIDTH} flexShrink={0} justifyContent="flex-end">
              <Text
                color={deletingFg}
                backgroundColor={deletingBg}
                bold={isDeleting}
              >
                {countStr}
              </Text>
            </Box>
          </Box>
        );
```

- [ ] **Step 4: Run project list tests**

Run:

```bash
npm test -- __tests__/components/project-list.test.tsx
```

Expected: PASS, 3 tests passed.

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
git commit -m "feat(layout): 固定项目名称与数量列"
```

---

### Task 4: Stabilize Session Row Columns

**Files:**
- Modify: `src/components/SessionList.tsx`
- Create: `__tests__/components/session-list.test.tsx`

- [ ] **Step 1: Write failing component structure tests**

Create `__tests__/components/session-list.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import SessionList from '../../src/components/SessionList.js';
import type { Project, Session } from '../../src/core/types.js';

const project: Project = {
  name: 'accounting-agent',
  encodedPath: '-Users-test-accounting-agent',
  fullPath: '/tmp/accounting-agent',
  sessionCount: 1,
  totalSize: 1000,
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    uuid: 'aaa11111-2222-3333-4444-555566667777',
    project,
    label: '自我介绍和选择企业修改以及一个很长的中文标题',
    labelSource: 'custom-title',
    modifiedAt: new Date(2026, 5, 6, 18, 48),
    size: 1234567,
    isActive: false,
    artifactDirExists: false,
    ...overrides,
  };
}

function getSessionItem(element: React.ReactElement): React.ReactElement {
  const rootChildren = React.Children.toArray(element.props.children) as React.ReactElement[];
  return rootChildren[0] as React.ReactElement;
}

describe('SessionList layout', () => {
  it('renders label and timestamp as fixed row columns', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const item = getSessionItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];

    expect(columns).toHaveLength(2);
    expect(columns[0].props.flexGrow).toBe(1);
    expect(columns[0].props.overflowX).toBe('hidden');
    expect(columns[1].props.width).toBe(12);
    expect(columns[1].props.flexShrink).toBe(0);
  });

  it('truncates CJK labels instead of wrapping', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const item = getSessionItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];
    const labelColumn = columns[0] as React.ReactElement;
    const labelText = React.Children.toArray(labelColumn.props.children)[0] as React.ReactElement;

    expect(labelText.props.wrap).toBe('truncate');
  });

  it('shows timestamp only and does not include file size in row metadata', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: false,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const item = getSessionItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];
    const timestampColumn = columns[1] as React.ReactElement;
    const timestampText = React.Children.toArray(timestampColumn.props.children)[0] as React.ReactElement;

    expect(timestampText.props.children).toBe('06-06 18:48');
  });

  it('uses active green background without appending an active marker', () => {
    const element = SessionList({
      sessions: [makeSession({ isActive: true })],
      selectedIndex: 0,
      isFocused: false,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const item = getSessionItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];
    const labelColumn = columns[0] as React.ReactElement;
    const labelText = React.Children.toArray(labelColumn.props.children)[0] as React.ReactElement;

    expect(labelText.props.backgroundColor).toBe('green');
    expect(JSON.stringify(labelText.props.children)).not.toContain(' *');
  });
});
```

- [ ] **Step 2: Run the new session component tests to verify failure**

Run:

```bash
npm test -- __tests__/components/session-list.test.tsx
```

Expected: FAIL because the current row uses `justifyContent="space-between"`, includes file size in `metaStr`, and appends an active `*` marker.

- [ ] **Step 3: Replace session row rendering with fixed columns**

Modify `src/components/SessionList.tsx`.

Remove `formatSize()` completely.

Add a timestamp column constant below `labelIcon()`:

```typescript
const TIMESTAMP_COLUMN_WIDTH = 12;
```

Keep `formatDate()` returning:

```typescript
return `${m}-${d} ${h}:${min}`;
```

Replace per-row metadata and row rendering inside `visibleSessions.map(...)` with:

```tsx
        const icon = labelIcon(session.labelSource);
        const timestamp = formatDate(session.modifiedAt);
        const labelText = `${icon.char} ${session.label}`;
        const isSelectedFocused = isSelected && isFocused;

        let rowBg: string | undefined;
        let rowFg: string | undefined;
        let bold = false;

        if (isDeleting) {
          rowBg = 'red';
          rowFg = 'white';
          bold = true;
        } else if (isSelectedFocused) {
          rowBg = 'cyan';
          rowFg = 'black';
        } else if (session.isActive) {
          rowBg = 'green';
          rowFg = 'black';
        }

        const iconColor = rowFg ?? icon.color;

        return (
          <Box key={session.uuid}>
            <Box flexGrow={1} overflowX="hidden">
              <Text
                wrap="truncate"
                color={rowFg}
                backgroundColor={rowBg}
                bold={bold}
              >
                {icon.char === ' ' ? (
                  <Text color={rowFg} backgroundColor={rowBg}>{'  '}</Text>
                ) : (
                  <Text color={iconColor} backgroundColor={rowBg}>{icon.char}</Text>
                )}
                <Text color={rowFg} backgroundColor={rowBg}>{' '}{session.label}</Text>
              </Text>
            </Box>
            <Box width={TIMESTAMP_COLUMN_WIDTH} flexShrink={0} justifyContent="flex-end">
              <Text
                color={rowFg}
                backgroundColor={rowBg}
                bold={bold}
                dimColor={!isSelectedFocused && !session.isActive && !isDeleting}
              >
                {timestamp}
              </Text>
            </Box>
          </Box>
        );
```

- [ ] **Step 4: Run session list tests**

Run:

```bash
npm test -- __tests__/components/session-list.test.tsx
```

Expected: PASS, 4 tests passed.

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
git commit -m "feat(layout): 固定会话标题与时间列"
```

---

### Task 5: Full Verification And Build

**Files:**
- Verify only; no required source edits.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS. Existing core tests plus new layout/component tests pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS. `tsup` builds `dist/main.js` successfully.

- [ ] **Step 3: Run a non-interactive list smoke test**

Run:

```bash
node dist/main.js list
```

Expected: PASS. Command prints JSON array output or `[]`; it must not throw.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --stat HEAD
git status --short
```

Expected: only intentional implementation files are modified or added. The unrelated untracked empty `AGENTS.md` file may still appear and must not be staged unless the user explicitly asks.

- [ ] **Step 5: Commit verification-related cleanup if needed**

If Task 5 required source or test adjustments, commit them:

```bash
git add src __tests__
git commit -m "test(layout): 验证 TUI 布局稳定性"
```

If Task 5 made no file changes, do not create an empty commit.

---

## Plan Self-Review

Spec coverage:

- Adaptive project pane width: Task 1 and Task 2.
- Project name/count fixed columns: Task 3.
- Session label/timestamp fixed columns: Task 4.
- Timestamp only, no file size in TUI row: Task 4.
- No active trailing marker, active green background: Task 4.
- Background priority and continuity: Task 4 tests inspect configured row background; Task 5 verifies full rendering/build.
- CJK truncation coverage: Task 4 includes a Chinese long label and requires `wrap="truncate"`.
- Future preview pane boundary: Task 2 centralizes pane width calculation in `app.tsx`/helper; no preview implementation is added.

Placeholder scan:

- The plan contains no TBD/TODO placeholders.
- Every code-changing step includes the concrete code to add or replace.
- Every verification step includes exact commands and expected results.

Type consistency:

- `calculateProjectPaneWidth()` is introduced in Task 1 and imported in Task 2.
- `ProjectListProps.width` is introduced before `app.tsx` passes it.
- `TIMESTAMP_COLUMN_WIDTH` is local to `SessionList.tsx` and used only by the session row timestamp column.
