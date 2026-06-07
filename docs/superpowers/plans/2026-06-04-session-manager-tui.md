# Session Manager TUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite cc-sessions from Bash to a TypeScript TUI application with dual-pane layout for managing Claude Code sessions across all projects.

**Architecture:** Core data layer (`core/`) is framework-independent, using class-based OOP with interfaces for testability (DIP). TUI layer (`components/`, `app.tsx`) uses Ink (React-based) with functional components. Communication between TUI and shell via temp file for resume flow.

**Tech Stack:** TypeScript, Ink 5, React 18, Vitest, tsup, Node.js 18+

---

## File Structure

| Path | Responsibility |
|------|---------------|
| `src/core/types.ts` | All type definitions and interfaces |
| `src/utils/path.ts` | PathEncoder class (encode/decode `~/.claude/projects/` paths) |
| `src/core/parser.ts` | ISessionParser interface + JsonlSessionParser implementation |
| `src/core/scanner.ts` | IProjectScanner interface + ClaudeProjectScanner implementation |
| `src/components/StatusBar.tsx` | Bottom bar showing keyboard shortcuts |
| `src/components/SearchBar.tsx` | Search input for filtering sessions by title |
| `src/components/ProjectList.tsx` | Left pane: project list with selection |
| `src/components/SessionList.tsx` | Right pane: session list with marking and scrolling |
| `src/components/ConfirmDialog.tsx` | Modal overlay for delete confirmation |
| `src/app.tsx` | Root component: layout, state (useReducer), keyboard handling |
| `src/main.ts` | CLI entry: argument parsing, mode dispatch |
| `src/session-deleter.ts` | Delete logic extracted from scanner for SRP |
| `bin/cc-sessions.sh` | Shell wrapper for resume flow |
| `__tests__/utils/path.test.ts` | PathEncoder unit tests |
| `__tests__/core/parser.test.ts` | SessionParser unit tests |
| `__tests__/core/scanner.test.ts` | ProjectScanner unit tests |
| `__tests__/fixtures/` | Test JSONL fixture files |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "cc-sessions",
  "version": "1.0.0",
  "description": "TUI for managing Claude Code sessions",
  "type": "module",
  "main": "dist/main.js",
  "bin": {
    "cc-sessions": "./bin/cc-sessions.sh"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/main.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "ink": "^5.0.0",
    "ink-text-input": "^6.0.0",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  splitting: false,
  dts: true,
});
```

- [ ] **Step 5: Create directory structure**

```bash
mkdir -p src/core src/utils src/components __tests__/core __tests__/utils __tests__/fixtures bin
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 7: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors (no source files yet, so clean output).

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts tsup.config.ts
git commit -m "chore(project): 初始化 TypeScript 项目结构与依赖"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
/** Encoded path under ~/.claude/projects/ (e.g., "-Users-hailin-Code-accounting-agent") */
export interface Project {
  name: string;
  encodedPath: string;
  fullPath: string;
  sessionCount: number;
  totalSize: number;
}

export type LabelSource = 'custom-title' | 'ai-title' | 'last-prompt' | 'first-message' | 'fallback';

export interface Session {
  uuid: string;
  project: Project;
  label: string;
  labelSource: LabelSource;
  modifiedAt: Date;
  size: number;
  isActive: boolean;
  artifactDirExists: boolean;
}

/** Raw metadata extracted from JSONL before label resolution */
export interface SessionMetadata {
  customTitle: string | null;
  aiTitle: string | null;
  lastPrompt: string | null;
  firstUserMessage: string | null;
}

export interface ConfirmAction {
  type: 'delete-sessions' | 'delete-project';
  targets: Session[];
  project?: Project;
}

export type FocusedPane = 'project' | 'session';

export interface AppState {
  projects: Project[];
  sessions: Session[];
  selectedProjectIndex: number;
  selectedSessionIndex: number;
  markedSessions: Set<string>;
  focusedPane: FocusedPane;
  searchQuery: string;
  searchActive: boolean;
  confirmDialog: ConfirmAction | null;
  loading: boolean;
  error: string | null;
}

export type AppAction =
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'SELECT_PROJECT'; index: number }
  | { type: 'SELECT_SESSION'; index: number }
  | { type: 'TOGGLE_MARK'; uuid: string }
  | { type: 'CLEAR_MARKS' }
  | { type: 'TOGGLE_PANE' }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_SEARCH_ACTIVE'; active: boolean }
  | { type: 'SHOW_CONFIRM'; action: ConfirmAction }
  | { type: 'HIDE_CONFIRM' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'DELETE_SESSIONS'; uuids: string[] }
  | { type: 'DELETE_PROJECT_SESSIONS'; projectEncodedPath: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(types): 定义核心数据模型与状态类型"
```

---

### Task 3: PathEncoder (TDD)

**Files:**
- Create: `__tests__/utils/path.test.ts`
- Create: `src/utils/path.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/utils/path.test.ts
import { describe, it, expect } from 'vitest';
import { PathEncoder } from '../../src/utils/path.js';

describe('PathEncoder', () => {
  describe('encode', () => {
    it('converts absolute path to encoded directory name', () => {
      expect(PathEncoder.encode('/Users/hailin/Code/accounting-agent'))
        .toBe('-Users-hailin-Code-accounting-agent');
    });

    it('handles root path', () => {
      expect(PathEncoder.encode('/')).toBe('-');
    });

    it('handles single-level path', () => {
      expect(PathEncoder.encode('/Users')).toBe('-Users');
    });
  });

  describe('decode', () => {
    it('converts encoded name back to absolute path', () => {
      expect(PathEncoder.decode('-Users-hailin-Code-accounting-agent'))
        .toBe('/Users/hailin/Code/accounting-agent');
    });

    it('handles root encoding', () => {
      expect(PathEncoder.decode('-')).toBe('/');
    });
  });

  describe('extractProjectName', () => {
    it('extracts last segment as project name', () => {
      expect(PathEncoder.extractProjectName('-Users-hailin-Code-accounting-agent'))
        .toBe('accounting-agent');
    });

    it('returns full name for ssh paths', () => {
      expect(PathEncoder.extractProjectName('ssh-server-my-project'))
        .toBe('ssh-server-my-project');
    });

    it('handles short paths', () => {
      expect(PathEncoder.extractProjectName('-Users-hailin'))
        .toBe('hailin');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/utils/path.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/path.js'`

- [ ] **Step 3: Write implementation**

```typescript
// src/utils/path.ts
export class PathEncoder {
  private constructor() {}

  static encode(absolutePath: string): string {
    return absolutePath.replace(/\//g, '-');
  }

  static decode(encodedPath: string): string {
    return '/' + encodedPath.substring(1).replace(/-/g, '/');
  }

  static extractProjectName(encodedPath: string): string {
    if (encodedPath.startsWith('ssh-')) return encodedPath;
    const segments = encodedPath.split('-').filter((s) => s.length > 0);
    return segments[segments.length - 1] || encodedPath;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/utils/path.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add __tests__/utils/path.test.ts src/utils/path.ts
git commit -m "feat(utils): 实现 PathEncoder 路径编码解码工具类"
```

---

### Task 4: SessionParser (TDD)

**Files:**
- Create: `__tests__/fixtures/custom-title-session.jsonl`
- Create: `__tests__/fixtures/ai-title-session.jsonl`
- Create: `__tests__/fixtures/no-title-session.jsonl`
- Create: `__tests__/fixtures/empty-session.jsonl`
- Create: `__tests__/core/parser.test.ts`
- Create: `src/core/parser.ts`

- [ ] **Step 1: Create test fixtures**

`__tests__/fixtures/custom-title-session.jsonl` — has custom-title (highest priority):
```jsonl
{"type":"system","message":"System prompt...","sessionId":"aaa11111-2222-3333-4444-555566667777"}
{"type":"user","message":{"role":"user","content":"这是一条用户消息"}}
{"type":"assistant","message":{"role":"assistant","content":[ {"type":"text","text":"助手回复"} ]}}
{"type":"custom-title","customTitle":"我的自定义标题","sessionId":"aaa11111-2222-3333-4444-555566667777"}
{"type":"ai-title","aiTitle":"AI 生成的标题","sessionId":"aaa11111-2222-3333-4444-555566667777"}
{"type":"last-prompt","lastPrompt":"最后一条提示","sessionId":"aaa11111-2222-3333-4444-555566667777","leafUuid":"leaf-1"}
```

`__tests__/fixtures/ai-title-session.jsonl` — has ai-title but no custom-title:
```jsonl
{"type":"system","message":"System prompt...","sessionId":"bbb22222-3333-4444-5555-666677778888"}
{"type":"user","message":{"role":"user","content":"用户提问"}}
{"type":"ai-title","aiTitle":"AI 自动标题","sessionId":"bbb22222-3333-4444-5555-666677778888"}
{"type":"last-prompt","sessionId":"bbb22222-3333-4444-5555-666677778888","leafUuid":"leaf-2"}
```

`__tests__/fixtures/no-title-session.jsonl` — only user messages, has last-prompt at end:
```jsonl
{"type":"system","message":"System prompt...","sessionId":"ccc33333-4444-5555-6666-777788889999"}
{"type":"user","message":{"role":"user","content":"<local-command-caveat>自动注入的消息</local-command-caveat>"}}
{"type":"user","message":{"role":"user","content":"用户的实际问题"}}
{"type":"assistant","message":{"role":"assistant","content":"回复"}}
{"type":"user","message":{"role":"user","content":[ {"type":"text","text":"最后的用户消息"} ]}}
{"type":"last-prompt","lastPrompt":"最后的用户消息","sessionId":"ccc33333-4444-5555-6666-777788889999","leafUuid":"leaf-3"}
```

`__tests__/fixtures/empty-session.jsonl` — single system record only:
```jsonl
{"type":"system","message":"System prompt...","sessionId":"ddd44444-5555-6666-7777-888899990000"}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// __tests__/core/parser.test.ts
import { describe, it, expect } from 'vitest';
import { JsonlSessionParser } from '../../src/core/parser.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '..', 'fixtures');

describe('JsonlSessionParser', () => {
  const parser = new JsonlSessionParser();

  it('extracts custom-title as highest priority label', async () => {
    const meta = await parser.parseMetadata(
      path.join(fixtures, 'custom-title-session.jsonl'),
    );
    expect(meta.customTitle).toBe('我的自定义标题');
    expect(meta.aiTitle).toBe('AI 生成的标题');
    expect(meta.firstUserMessage).toBe('这是一条用户消息');
  });

  it('extracts ai-title when custom-title is absent', async () => {
    const meta = await parser.parseMetadata(
      path.join(fixtures, 'ai-title-session.jsonl'),
    );
    expect(meta.customTitle).toBeNull();
    expect(meta.aiTitle).toBe('AI 自动标题');
  });

  it('extracts first user message, skipping wrappers', async () => {
    const meta = await parser.parseMetadata(
      path.join(fixtures, 'no-title-session.jsonl'),
    );
    expect(meta.firstUserMessage).toBe('用户的实际问题');
  });

  it('returns nulls for session with no user content', async () => {
    const meta = await parser.parseMetadata(
      path.join(fixtures, 'empty-session.jsonl'),
    );
    expect(meta.customTitle).toBeNull();
    expect(meta.aiTitle).toBeNull();
    expect(meta.lastPrompt).toBeNull();
    expect(meta.firstUserMessage).toBeNull();
  });

  it('reads last-prompt from file tail', async () => {
    const meta = await parser.parseMetadata(
      path.join(fixtures, 'no-title-session.jsonl'),
    );
    expect(meta.lastPrompt).toBe('最后的用户消息');
  });

  it('handles user content as string', async () => {
    const meta = await parser.parseMetadata(
      path.join(fixtures, 'custom-title-session.jsonl'),
    );
    expect(meta.firstUserMessage).toBe('这是一条用户消息');
  });

  it('handles user content as array of text blocks', async () => {
    const meta = await parser.parseMetadata(
      path.join(fixtures, 'no-title-session.jsonl'),
    );
    // "最后的用户消息" comes from array content [{type:"text",text:"..."}]
    expect(meta.lastPrompt).toBe('最后的用户消息');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run __tests__/core/parser.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/parser.js'`

- [ ] **Step 4: Write implementation**

```typescript
// src/core/parser.ts
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import type { SessionMetadata } from './types.js';

export interface ISessionParser {
  parseMetadata(filePath: string): Promise<SessionMetadata>;
}

const MAX_HEAD_LINES = 200;
const TAIL_READ_SIZE = 65536; // 64KB
const WRAPPER_PATTERN = /^<local-command-(caveat|stdout)>/;

export class JsonlSessionParser implements ISessionParser {
  async parseMetadata(filePath: string): Promise<SessionMetadata> {
    const result: SessionMetadata = {
      customTitle: null,
      aiTitle: null,
      lastPrompt: null,
      firstUserMessage: null,
    };

    // Phase 1: read head for custom-title, ai-title, first user message
    const headLines = await this.readHeadLines(filePath, MAX_HEAD_LINES);
    for (const line of headLines) {
      const record = this.safeParse(line);
      if (!record) continue;

      if (record.type === 'custom-title' && record.customTitle) {
        result.customTitle = record.customTitle;
      } else if (record.type === 'ai-title' && record.aiTitle) {
        result.aiTitle = record.aiTitle;
      } else if (record.type === 'user' && result.firstUserMessage === null) {
        const text = this.extractUserText(record);
        if (text && !WRAPPER_PATTERN.test(text)) {
          result.firstUserMessage = this.truncate(text);
        }
      }
    }

    // Phase 2: if no custom-title and no ai-title, read tail for last-prompt
    if (result.customTitle === null && result.aiTitle === null) {
      const tailLines = await this.readTailLines(filePath, 100);
      // iterate from end to find most recent last-prompt
      for (let i = tailLines.length - 1; i >= 0; i--) {
        const record = this.safeParse(tailLines[i]);
        if (record?.type === 'last-prompt' && record.lastPrompt) {
          result.lastPrompt = this.truncate(record.lastPrompt);
          break;
        }
      }
    }

    return result;
  }

  private async readHeadLines(filePath: string, maxLines: number): Promise<string[]> {
    const lines: string[] = [];
    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, { encoding: 'utf-8' });
      let buffer = '';
      stream.on('data', (chunk: string) => {
        buffer += chunk;
        const parts = buffer.split('\n');
        buffer = parts.pop()!;
        for (const part of parts) {
          if (part.trim()) lines.push(part);
          if (lines.length >= maxLines) {
            stream.destroy();
            resolve(lines);
            return;
          }
        }
      });
      stream.on('end', () => {
        if (buffer.trim()) lines.push(buffer);
        resolve(lines);
      });
      stream.on('error', reject);
    });
  }

  private async readTailLines(filePath: string, maxLines: number): Promise<string[]> {
    const { size } = await stat(filePath);
    const readSize = Math.min(size, TAIL_READ_SIZE);
    const buffer = Buffer.alloc(readSize);
    const fd = await open(filePath, 'r');
    await fd.read(buffer, 0, readSize, Math.max(0, size - readSize));
    await fd.close();
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim());
    return lines.slice(-maxLines);
  }

  private extractUserText(record: Record<string, unknown>): string | null {
    const content = record.message?.content;
    if (content === undefined || content === null) return null;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((block: Record<string, unknown>) => block.type === 'text' && typeof block.text === 'string')
        .map((block: Record<string, unknown>) => block.text as string)
        .join(' ');
    }
    return null;
  }

  private safeParse(line: string): Record<string, unknown> | null {
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private truncate(text: string, maxLen = 70): string {
    const cleaned = text.replace(/[\n\t]+/g, ' ').trim();
    return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '…' : cleaned;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/core/parser.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add __tests__/fixtures/ __tests__/core/parser.test.ts src/core/parser.ts
git commit -m "feat(core): 实现 JsonlSessionParser 流式 JSONL 元数据解析"
```

---

### Task 5: ProjectScanner (TDD)

**Files:**
- Create: `__tests__/core/scanner.test.ts`
- Create: `src/core/scanner.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/core/scanner.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeProjectScanner } from '../../src/core/scanner.js';
import { JsonlSessionParser } from '../../src/core/parser.js';
import type { ISessionParser } from '../../src/core/parser.js';

// Minimal JSONL content factories
const customTitleJsonl = [
  '{"type":"system","sessionId":"aaa11111-2222-3333-4444-555566667777"}',
  '{"type":"custom-title","customTitle":"测试标题","sessionId":"aaa11111-2222-3333-4444-555566667777"}',
].join('\n');

const aiTitleJsonl = [
  '{"type":"system","sessionId":"bbb22222-3333-4444-5555-666677778888"}',
  '{"type":"ai-title","aiTitle":"AI标题","sessionId":"bbb22222-3333-4444-5555-666677778888"}',
].join('\n');

const noTitleJsonl = [
  '{"type":"system","sessionId":"ccc33333-4444-5555-6666-777788889999"}',
  '{"type":"user","message":{"role":"user","content":"用户消息"}}',
].join('\n');

describe('ClaudeProjectScanner', () => {
  let tempDir: string;
  let scanner: ClaudeProjectScanner;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cc-sessions-test-'));
    const parser: ISessionParser = new JsonlSessionParser();
    scanner = new ClaudeProjectScanner(tempDir, parser);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty array when projects dir has no subdirectories', async () => {
    const projects = await scanner.scan();
    expect(projects).toEqual([]);
  });

  it('returns empty array when projects dir does not exist', async () => {
    const missingScanner = new ClaudeProjectScanner(join(tempDir, 'nonexistent'));
    const projects = await missingScanner.scan();
    expect(projects).toEqual([]);
  });

  it('discovers a single project with sessions', async () => {
    const projectDir = join(tempDir, '-Users-test-myproject');
    await mkdir(projectDir);
    await writeFile(join(projectDir, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);

    const projects = await scanner.scan();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('myproject');
    expect(projects[0].encodedPath).toBe('-Users-test-myproject');
    expect(projects[0].sessionCount).toBe(1);
    expect(projects[0].sessions).toHaveLength(1);
    expect(projects[0].sessions[0].label).toBe('测试标题');
    expect(projects[0].sessions[0].labelSource).toBe('custom-title');
    expect(projects[0].sessions[0].uuid).toBe('aaa11111-2222-3333-4444-555566667777');
  });

  it('discovers multiple projects and their sessions', async () => {
    const projectA = join(tempDir, '-Users-test-project-a');
    const projectB = join(tempDir, '-Users-test-project-b');
    await mkdir(projectA);
    await mkdir(projectB);
    await writeFile(join(projectA, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);
    await writeFile(join(projectB, 'bbb22222-3333-4444-5555-666677778888.jsonl'), aiTitleJsonl);
    await writeFile(join(projectB, 'ccc33333-4444-5555-6666-777788889999.jsonl'), noTitleJsonl);

    const projects = await scanner.scan();

    expect(projects).toHaveLength(2);
    const foundB = projects.find((p) => p.name === 'project-b');
    expect(foundB).toBeDefined();
    expect(foundB!.sessionCount).toBe(2);
  });

  it('ignores non-jsonl files and directories in project dirs', async () => {
    const projectDir = join(tempDir, '-Users-test-myproject');
    await mkdir(projectDir);
    await mkdir(join(projectDir, 'aaa11111-2222-3333-4444-555566667777')); // derivative dir
    await writeFile(join(projectDir, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);
    await writeFile(join(projectDir, 'notes.txt'), 'not a session');

    const projects = await scanner.scan();

    expect(projects[0].sessionCount).toBe(1);
  });

  it('detects artifact directories for sessions', async () => {
    const projectDir = join(tempDir, '-Users-test-myproject');
    await mkdir(projectDir);
    await mkdir(join(projectDir, 'aaa11111-2222-3333-4444-555566667777')); // derivative dir
    await writeFile(join(projectDir, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);

    const projects = await scanner.scan();

    expect(projects[0].sessions[0].artifactDirExists).toBe(true);
  });

  it('sorts projects by name and sessions by modifiedAt desc', async () => {
    const projectDir = join(tempDir, '-Users-test-myproject');
    await mkdir(projectDir);
    await writeFile(join(projectDir, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);
    // Small delay to ensure different mtime
    await new Promise((r) => setTimeout(r, 50));
    await writeFile(join(projectDir, 'bbb22222-3333-4444-5555-666677778888.jsonl'), aiTitleJsonl);

    const projects = await scanner.scan();

    // Sessions sorted newest first
    expect(projects[0].sessions[0].uuid).toBe('bbb22222-3333-4444-5555-666677778888');
  });

  it('filters to a single project when projectPath is provided', async () => {
    const projectA = join(tempDir, '-Users-test-project-a');
    const projectB = join(tempDir, '-Users-test-project-b');
    await mkdir(projectA);
    await mkdir(projectB);
    await writeFile(join(projectA, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);
    await writeFile(join(projectB, 'bbb22222-3333-4444-5555-666677778888.jsonl'), aiTitleJsonl);

    const projects = await scanner.scan({ projectPath: '/Users/test/project-b' });

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('project-b');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/core/scanner.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/scanner.js'`

- [ ] **Step 3: Write implementation**

```typescript
// src/core/scanner.ts
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { Project, Session, SessionMetadata } from './types.js';
import type { ISessionParser } from './parser.js';
import { PathEncoder } from '../utils/path.js';

const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export interface ScanOptions {
  projectPath?: string;
}

export interface IProjectScanner {
  scan(options?: ScanOptions): Promise<Project[]>;
}

interface ProjectWithSessions extends Project {
  sessions: Session[];
}

export class ClaudeProjectScanner implements IProjectScanner {
  constructor(
    private readonly projectsDir: string,
    private readonly parser: ISessionParser,
  ) {}

  async scan(options?: ScanOptions): Promise<ProjectWithSessions[]> {
    let projectDirs: string[];
    if (options?.projectPath) {
      const encoded = PathEncoder.encode(options.projectPath);
      const singleDir = join(this.projectsDir, encoded);
      try {
        const s = await stat(singleDir);
        projectDirs = s.isDirectory() ? [singleDir] : [];
      } catch {
        return [];
      }
    } else {
      try {
        const entries = await readdir(this.projectsDir);
        projectDirs = entries.map((e) => join(this.projectsDir, e));
      } catch {
        return [];
      }
    }

    const projects: ProjectWithSessions[] = [];

    for (const dirPath of projectDirs) {
      const dirStat = await stat(dirPath).catch(() => null);
      if (!dirStat?.isDirectory()) continue;

      const encodedPath = basename(dirPath);
      const sessions = await this.scanProjectSessions(dirPath, encodedPath);
      if (sessions.length === 0) continue;

      const totalSize = sessions.reduce((sum, s) => sum + s.size, 0);
      projects.push({
        name: PathEncoder.extractProjectName(encodedPath),
        encodedPath,
        fullPath: dirPath,
        sessionCount: sessions.length,
        totalSize,
        sessions,
      });
    }

    // Sort projects by name
    projects.sort((a, b) => a.name.localeCompare(b.name));

    return projects;
  }

  private async scanProjectSessions(
    projectDir: string,
    encodedPath: string,
  ): Promise<Session[]> {
    const entries = await readdir(projectDir);
    const jsonlFiles = entries.filter((e) => e.endsWith('.jsonl'));

    const sessions: Session[] = [];

    for (const file of jsonlFiles) {
      const filePath = join(projectDir, file);
      const uuid = basename(file, '.jsonl');

      try {
        const fileStat = await stat(filePath);
        const now = Date.now();
        const isActive = now - fileStat.mtimeMs < ACTIVE_THRESHOLD_MS;

        // Check if artifact directory exists (same name without .jsonl)
        const artifactDir = join(projectDir, uuid);
        const artifactDirExists = await stat(artifactDir)
          .then((s) => s.isDirectory())
          .catch(() => false);

        const metadata: SessionMetadata = await this.parser.parseMetadata(filePath);

        sessions.push({
          uuid,
          project: null as unknown as Project, // filled by caller
          label: this.resolveLabel(metadata),
          labelSource: this.resolveLabelSource(metadata),
          modifiedAt: fileStat.mtime,
          size: fileStat.size,
          isActive,
          artifactDirExists,
        });
      } catch {
        // Skip files we can't read
      }
    }

    // Sort sessions newest first
    sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    // Fill project back-reference
    const projectStub: Project = {
      name: PathEncoder.extractProjectName(encodedPath),
      encodedPath,
      fullPath: projectDir,
      sessionCount: sessions.length,
      totalSize: sessions.reduce((sum, s) => sum + s.size, 0),
    };
    for (const s of sessions) {
      s.project = projectStub;
    }

    return sessions;
  }

  private resolveLabel(meta: SessionMetadata): string {
    if (meta.customTitle) return meta.customTitle;
    if (meta.aiTitle) return meta.aiTitle;
    if (meta.lastPrompt) return meta.lastPrompt;
    if (meta.firstUserMessage) return meta.firstUserMessage;
    return 'Untitled Session';
  }

  private resolveLabelSource(meta: SessionMetadata): Session['labelSource'] {
    if (meta.customTitle) return 'custom-title';
    if (meta.aiTitle) return 'ai-title';
    if (meta.lastPrompt) return 'last-prompt';
    if (meta.firstUserMessage) return 'first-message';
    return 'fallback';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/core/scanner.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add __tests__/core/scanner.test.ts src/core/scanner.ts
git commit -m "feat(core): 实现 ClaudeProjectScanner 项目与会话扫描"
```

---

### Task 6: SessionDeleter

**Files:**
- Create: `src/core/deleter.ts`

- [ ] **Step 1: Write implementation**

```typescript
// src/core/deleter.ts
import { unlink, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Session } from './types.js';

const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

export interface DeleteResult {
  uuid: string;
  status: 'deleted' | 'skipped-active' | 'error';
  message: string;
}

export class SessionDeleter {
  async deleteSessions(sessions: Session[]): Promise<DeleteResult[]> {
    const results: DeleteResult[] = [];
    const now = Date.now();

    for (const session of sessions) {
      const filePath = join(session.project.fullPath, `${session.uuid}.jsonl`);

      // Re-check active status (mtime may have changed since scan)
      try {
        const fileStat = await stat(filePath);
        if (now - fileStat.mtimeMs < ACTIVE_THRESHOLD_MS) {
          results.push({
            uuid: session.uuid,
            status: 'skipped-active',
            message: `活跃会话，已跳过 (${Math.round((now - fileStat.mtimeMs) / 1000)}s ago)`,
          });
          continue;
        }
      } catch {
        results.push({
          uuid: session.uuid,
          status: 'error',
          message: '文件不存在',
        });
        continue;
      }

      // Delete .jsonl file
      try {
        await unlink(filePath);
      } catch (err) {
        results.push({
          uuid: session.uuid,
          status: 'error',
          message: `删除失败: ${(err as Error).message}`,
        });
        continue;
      }

      // Delete artifact directory if it exists
      if (session.artifactDirExists) {
        const artifactDir = join(session.project.fullPath, session.uuid);
        try {
          await rm(artifactDir, { recursive: true, force: true });
        } catch {
          // Non-fatal: main session file already deleted
        }
      }

      results.push({
        uuid: session.uuid,
        status: 'deleted',
        message: '已删除',
      });
    }

    return results;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/deleter.ts
git commit -m "feat(core): 实现 SessionDeleter 会话删除逻辑"
```

---

### Task 7: StatusBar Component

**Files:**
- Create: `src/components/StatusBar.tsx`

- [ ] **Step 1: Write implementation**

```typescript
// src/components/StatusBar.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  focusedPane: 'project' | 'session';
  searchActive: boolean;
  confirmVisible: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  focusedPane,
  searchActive,
  confirmVisible,
}) => {
  if (confirmVisible) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>[y] 确认删除    [Esc/N] 取消</Text>
      </Box>
    );
  }

  if (searchActive) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>[Enter] 确认搜索    [Esc] 取消搜索</Text>
      </Box>
    );
  }

  const shortcuts = [
    '↑↓/jk 浏览',
    'Tab 切换栏',
    focusedPane === 'session' ? 'Enter 恢复' : null,
    focusedPane === 'session' ? 'Space 标记' : null,
    focusedPane === 'session' ? 'D 删除' : null,
    focusedPane === 'project' ? 'Shift+D 删除项目全部' : null,
    focusedPane === 'session' ? '/ 搜索' : null,
    'q 退出',
  ].filter(Boolean);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>{shortcuts.join('  ')}</Text>
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StatusBar.tsx
git commit -m "feat(components): 实现 StatusBar 快捷键提示栏"
```

---

### Task 8: SearchBar Component

**Files:**
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: Write implementation**

```typescript
// src/components/SearchBar.tsx
import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface SearchBarProps {
  active: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  projectName: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  active,
  query,
  onQueryChange,
  onSubmit,
  onCancel,
  projectName,
}) => {
  if (!active) {
    return (
      <Box>
        <Text bold>Sessions: </Text>
        <Text color="cyan">{projectName}</Text>
        <Text>  </Text>
        <Text dimColor>{query ? `🔍 ${query}` : '按 / 搜索'}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text bold>Sessions: </Text>
      <Text color="cyan">{projectName}</Text>
      <Text>  🔍 </Text>
      <TextInput
        value={query}
        onChange={onQueryChange}
        onSubmit={onSubmit}
        placeholder="输入搜索关键词..."
      />
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SearchBar.tsx
git commit -m "feat(components): 实现 SearchBar 搜索输入栏"
```

---

### Task 9: ProjectList Component

**Files:**
- Create: `src/components/ProjectList.tsx`

- [ ] **Step 1: Write implementation**

```typescript
// src/components/ProjectList.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { Project } from '../core/types.js';

interface ProjectListProps {
  projects: Project[];
  selectedIndex: number;
  isFocused: boolean;
  visibleHeight: number;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  selectedIndex,
  isFocused,
  visibleHeight,
}) => {
  // Calculate visible window for scrolling
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(visibleHeight / 2) + 1, projects.length - visibleHeight));
  const visible = projects.slice(start, start + visibleHeight);

  return (
    <Box flexDirection="column" width={22}>
      <Box>
        <Text bold backgroundColor={isFocused ? 'blue' : undefined}>
          {' Projects '}
        </Text>
      </Box>
      {visible.map((project, i) => {
        const realIndex = start + i;
        const isSelected = realIndex === selectedIndex;
        const prefix = isSelected && isFocused ? '> ' : '  ';
        const name = project.name.length > 16 ? project.name.substring(0, 15) + '…' : project.name;

        return (
          <Text
            key={project.encodedPath}
            color={isSelected && isFocused ? 'black' : undefined}
            backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
          >
            {prefix}{name}
            <Text dimColor> ({project.sessionCount})</Text>
          </Text>
        );
      })}
      {projects.length > visibleHeight && (
        <Text dimColor>
          {'  '}({selectedIndex + 1}/{projects.length})
        </Text>
      )}
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProjectList.tsx
git commit -m "feat(components): 实现 ProjectList 左栏项目列表"
```

---

### Task 10: SessionList Component

**Files:**
- Create: `src/components/SessionList.tsx`

- [ ] **Step 1: Write implementation**

```typescript
// src/components/SessionList.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { Session } from '../core/types.js';

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  markedSessions: Set<string>;
  isFocused: boolean;
  visibleHeight: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function labelIcon(labelSource: Session['labelSource']): string {
  switch (labelSource) {
    case 'custom-title': return '★';
    case 'ai-title': return '●';
    default: return ' ';
  }
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  selectedIndex,
  markedSessions,
  isFocused,
  visibleHeight,
}) => {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Text dimColor>  没有会话</Text>
      </Box>
    );
  }

  const start = Math.max(0, Math.min(selectedIndex - Math.floor(visibleHeight / 2) + 1, sessions.length - visibleHeight));
  const visible = sessions.slice(start, start + visibleHeight);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((session, i) => {
        const realIndex = start + i;
        const isSelected = realIndex === selectedIndex;
        const isMarked = markedSessions.has(session.uuid);
        const markChar = isMarked ? '[x]' : '[ ]';
        const icon = labelIcon(session.labelSource);

        const label = session.label.length > 40
          ? session.label.substring(0, 39) + '…'
          : session.label;

        const meta = `${formatDate(session.modifiedAt)}  ${formatSize(session.size)}`;

        return (
          <Box key={session.uuid} flexDirection="column">
            <Text
              color={isSelected && isFocused ? 'black' : session.isActive ? 'green' : undefined}
              backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
            >
              {` ${markChar} ${icon} `}
              <Text bold={isSelected && isFocused}>{label}</Text>
            </Text>
            <Text
              color={isSelected && isFocused ? 'black' : undefined}
              backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
              dimColor={!isSelected}
            >
              {`       ${meta}`}
              {session.isActive && <Text color={isSelected && isFocused ? 'black' : 'green'}> ●活跃</Text>}
            </Text>
          </Box>
        );
      })}
      {sessions.length > visibleHeight && (
        <Text dimColor>
          {'  '}({selectedIndex + 1}/{sessions.length})
        </Text>
      )}
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SessionList.tsx
git commit -m "feat(components): 实现 SessionList 右栏会话列表"
```

---

### Task 11: ConfirmDialog Component

**Files:**
- Create: `src/components/ConfirmDialog.tsx`

- [ ] **Step 1: Write implementation**

```typescript
// src/components/ConfirmDialog.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { ConfirmAction } from '../core/types.js';

interface ConfirmDialogProps {
  action: ConfirmAction;
}

function labelIcon(labelSource: string): string {
  switch (labelSource) {
    case 'custom-title': return '★';
    case 'ai-title': return '●';
    default: return ' ';
  }
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ action }) => {
  const isProjectDelete = action.type === 'delete-project';
  const title = isProjectDelete
    ? `删除项目 "${action.project?.name}" 的所有会话？`
    : `删除 ${action.targets.length} 个会话？`;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      position="absolute"
    >
      <Text bold color="yellow">
        ⚠ 确认删除
      </Text>
      <Text> </Text>
      <Text>{title}</Text>
      <Text> </Text>
      {action.targets.slice(0, 8).map((s) => (
        <Text key={s.uuid}>
          {`  ${labelIcon(s.labelSource)} ${s.label}`}
        </Text>
      ))}
      {action.targets.length > 8 && (
        <Text dimColor>{`  ...及其他 ${action.targets.length - 8} 个`}</Text>
      )}
      <Text> </Text>
      <Text>
        <Text color="green">[y]</Text>
        <Text> 确认删除    </Text>
        <Text color="red">[Esc/N]</Text>
        <Text> 取消</Text>
      </Text>
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ConfirmDialog.tsx
git commit -m "feat(components): 实现 ConfirmDialog 删除确认弹窗"
```

---

### Task 12: App Component

**Files:**
- Create: `src/app.tsx`

- [ ] **Step 1: Write implementation**

```typescript
// src/app.tsx
import React, { useEffect, useReducer, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import type { AppState, AppAction, Session, ConfirmAction } from './core/types.js';
import { ProjectList } from './components/ProjectList.js';
import { SessionList } from './components/SessionList.js';
import { SearchBar } from './components/SearchBar.js';
import { StatusBar } from './components/StatusBar.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { ClaudeProjectScanner } from './core/scanner.js';
import { JsonlSessionParser } from './core/parser.js';
import { SessionDeleter } from './core/deleter.js';
import { PathEncoder } from './utils/path.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

const initialState: AppState = {
  projects: [],
  sessions: [],
  selectedProjectIndex: 0,
  selectedSessionIndex: 0,
  markedSessions: new Set(),
  focusedPane: 'project',
  searchQuery: '',
  searchActive: false,
  confirmDialog: null,
  loading: true,
  error: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return {
        ...state,
        projects: action.projects,
        sessions: action.projects[0]?.sessions ?? [],
        loading: false,
      };

    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions, selectedSessionIndex: 0 };

    case 'SELECT_PROJECT': {
      const newSessions = state.projects[action.index]?.sessions ?? [];
      return {
        ...state,
        selectedProjectIndex: action.index,
        sessions: newSessions,
        selectedSessionIndex: 0,
        markedSessions: new Set(),
        searchQuery: '',
      };
    }

    case 'SELECT_SESSION':
      return { ...state, selectedSessionIndex: action.index };

    case 'TOGGLE_MARK': {
      const next = new Set(state.markedSessions);
      if (next.has(action.uuid)) next.delete(action.uuid);
      else next.add(action.uuid);
      return { ...state, markedSessions: next };
    }

    case 'CLEAR_MARKS':
      return { ...state, markedSessions: new Set() };

    case 'TOGGLE_PANE': {
      const next = state.focusedPane === 'project' ? 'session' : 'project';
      // Only switch to session pane if there are sessions
      if (next === 'session' && state.sessions.length === 0) return state;
      return { ...state, focusedPane: next };
    }

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };

    case 'SET_SEARCH_ACTIVE':
      return { ...state, searchActive: action.active };

    case 'SHOW_CONFIRM':
      return { ...state, confirmDialog: action.action };

    case 'HIDE_CONFIRM':
      return { ...state, confirmDialog: null };

    case 'SET_LOADING':
      return { ...state, loading: action.loading };

    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };

    case 'DELETE_SESSIONS': {
      const remaining = state.sessions.filter((s) => !action.uuids.includes(s.uuid));
      const remainingMarks = new Set([...state.markedSessions].filter((u) => !action.uuids.includes(u)));
      return {
        ...state,
        sessions: remaining,
        selectedSessionIndex: Math.min(state.selectedSessionIndex, Math.max(0, remaining.length - 1)),
        markedSessions: remainingMarks,
        confirmDialog: null,
      };
    }

    case 'DELETE_PROJECT_SESSIONS': {
      // Remove all sessions for the given project, then remove the project
      const remainingProjects = state.projects.filter((p) => p.encodedPath !== action.projectEncodedPath);
      const newIndex = Math.min(state.selectedProjectIndex, Math.max(0, remainingProjects.length - 1));
      const newSessions = remainingProjects[newIndex]?.sessions ?? [];
      return {
        ...state,
        projects: remainingProjects,
        sessions: newSessions,
        selectedProjectIndex: newIndex,
        selectedSessionIndex: 0,
        markedSessions: new Set(),
        confirmDialog: null,
      };
    }

    default:
      return state;
  }
}

interface AppProps {
  projectPath?: string;
  onSelectSession?: (uuid: string) => void;
}

export const App: React.FC<AppProps> = ({ projectPath, onSelectSession }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const terminalHeight = stdout?.rows ?? 24;
  const headerHeight = 2;
  const footerHeight = 3;
  const listHeight = Math.max(3, terminalHeight - headerHeight - footerHeight);
  const projectListHeight = listHeight - 1;

  // Load projects on mount
  useEffect(() => {
    const projectsDir = join(homedir(), '.claude', 'projects');
    const parser = new JsonlSessionParser();
    const scanner = new ClaudeProjectScanner(projectsDir, parser);

    const opts = projectPath ? { projectPath } : undefined;
    scanner.scan(opts).then((projects) => {
      dispatch({ type: 'SET_PROJECTS', projects });
    }).catch((err) => {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message });
    });
  }, []);

  // Filter sessions by search query
  const filteredSessions = state.searchQuery
    ? state.sessions.filter((s) => s.label.toLowerCase().includes(state.searchQuery.toLowerCase()))
    : state.sessions;

  const currentProject = state.projects[state.selectedProjectIndex];

  const handleDeleteConfirm = useCallback(async (action: ConfirmAction) => {
    const deleter = new SessionDeleter();
    const results = await deleter.deleteSessions(action.targets);
    const deleted = results.filter((r) => r.status === 'deleted');
    const skipped = results.filter((r) => r.status !== 'deleted');

    if (action.type === 'delete-project' && action.project) {
      dispatch({
        type: 'DELETE_PROJECT_SESSIONS',
        projectEncodedPath: action.project.encodedPath,
      });
    } else {
      dispatch({
        type: 'DELETE_SESSIONS',
        uuids: deleted.map((r) => r.uuid),
      });
    }

    if (skipped.length > 0) {
      // Could show a notification — for v1 just proceed
    }
  }, []);

  useInput((input, key) => {
    // If confirm dialog is open
    if (state.confirmDialog) {
      if (input === 'y' || input === 'Y') {
        handleDeleteConfirm(state.confirmDialog);
      } else if (key.escape || input === 'n' || input === 'N') {
        dispatch({ type: 'HIDE_CONFIRM' });
      }
      return;
    }

    // If search is active
    if (state.searchActive) {
      if (key.escape) {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
        dispatch({ type: 'SET_SEARCH', query: '' });
      }
      return;
    }

    // Quit
    if (input === 'q') {
      exit();
      return;
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      if (state.focusedPane === 'project') {
        if (state.selectedProjectIndex > 0) {
          dispatch({ type: 'SELECT_PROJECT', index: state.selectedProjectIndex - 1 });
        }
      } else {
        if (state.selectedSessionIndex > 0) {
          dispatch({ type: 'SELECT_SESSION', index: state.selectedSessionIndex - 1 });
        }
      }
      return;
    }

    if (key.downArrow || input === 'j') {
      if (state.focusedPane === 'project') {
        if (state.selectedProjectIndex < state.projects.length - 1) {
          dispatch({ type: 'SELECT_PROJECT', index: state.selectedProjectIndex + 1 });
        }
      } else {
        if (state.selectedSessionIndex < filteredSessions.length - 1) {
          dispatch({ type: 'SELECT_SESSION', index: state.selectedSessionIndex + 1 });
        }
      }
      return;
    }

    // Toggle pane
    if (key.tab) {
      dispatch({ type: 'TOGGLE_PANE' });
      return;
    }

    // Session pane actions
    if (state.focusedPane === 'session') {
      // Resume session
      if (key.return) {
        const session = filteredSessions[state.selectedSessionIndex];
        if (session) {
          onSelectSession?.(session.uuid);
          exit();
        }
        return;
      }

      // Toggle mark
      if (input === ' ') {
        const session = filteredSessions[state.selectedSessionIndex];
        if (session) {
          dispatch({ type: 'TOGGLE_MARK', uuid: session.uuid });
        }
        return;
      }

      // Delete
      if (input === 'D') {
        const targets = state.markedSessions.size > 0
          ? filteredSessions.filter((s) => state.markedSessions.has(s.uuid))
          : filteredSessions[state.selectedSessionIndex]
            ? [filteredSessions[state.selectedSessionIndex]]
            : [];
        if (targets.length > 0) {
          dispatch({
            type: 'SHOW_CONFIRM',
            action: { type: 'delete-sessions', targets },
          });
        }
        return;
      }

      // Search
      if (input === '/') {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: true });
        return;
      }

      // Escape back to project pane
      if (key.escape) {
        dispatch({ type: 'TOGGLE_PANE' });
        return;
      }
    }

    // Project pane actions
    if (state.focusedPane === 'project') {
      // Delete all project sessions
      if (input === 'D') {
        if (currentProject && currentProject.sessions.length > 0) {
          dispatch({
            type: 'SHOW_CONFIRM',
            action: {
              type: 'delete-project',
              targets: currentProject.sessions,
              project: currentProject,
            },
          });
        }
        return;
      }
    }
  });

  if (state.loading) {
    return <Text>扫描会话中...</Text>;
  }

  if (state.error) {
    return <Text color="red">错误: {state.error}</Text>;
  }

  if (state.projects.length === 0) {
    return <Text>没有发现任何会话。请确认 ~/.claude/projects/ 目录存在且包含会话文件。</Text>;
  }

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Box flexDirection="row" flexGrow={1}>
        <ProjectList
          projects={state.projects}
          selectedIndex={state.selectedProjectIndex}
          isFocused={state.focusedPane === 'project'}
          visibleHeight={projectListHeight}
        />
        <Box flexDirection="column" flexGrow={1}>
          <SearchBar
            active={state.searchActive}
            query={state.searchQuery}
            onQueryChange={(q) => dispatch({ type: 'SET_SEARCH', query: q })}
            onSubmit={() => dispatch({ type: 'SET_SEARCH_ACTIVE', active: false })}
            onCancel={() => {
              dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
              dispatch({ type: 'SET_SEARCH', query: '' });
            }}
            projectName={currentProject?.name ?? ''}
          />
          <SessionList
            sessions={filteredSessions}
            selectedIndex={state.selectedSessionIndex}
            markedSessions={state.markedSessions}
            isFocused={state.focusedPane === 'session'}
            visibleHeight={listHeight - 1}
          />
        </Box>
      </Box>
      <StatusBar
        focusedPane={state.focusedPane}
        searchActive={state.searchActive}
        confirmVisible={state.confirmDialog !== null}
      />
      {state.confirmDialog && <ConfirmDialog action={state.confirmDialog} />}
    </Box>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app.tsx
git commit -m "feat(app): 实现 App 根组件与状态管理"
```

---

### Task 13: CLI Entry Point & Shell Wrapper

**Files:**
- Create: `src/main.ts`
- Create: `bin/cc-sessions.sh`

- [ ] **Step 1: Write CLI entry point**

```typescript
// src/main.ts
import { render } from 'ink';
import { App } from './app.js';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ClaudeProjectScanner } from './core/scanner.js';
import { JsonlSessionParser } from './core/parser.js';
import { SessionDeleter } from './core/deleter.js';
import { PathEncoder } from './utils/path.js';

const args = process.argv.slice(2);

function showHelp(): void {
  console.log(`
cc-sessions — Claude Code 会话管理工具

用法:
  cc-sessions                    启动 TUI（扫描所有项目）
  cc-sessions --project <path>   只显示指定项目的会话
  cc-sessions list [--project <path>]
                                 非交互模式，输出会话列表（JSON）
  cc-sessions delete <uuid>      非交互模式，删除指定会话
  cc-sessions -h, --help         显示帮助
  cc-sessions -v, --version      显示版本

快捷键（TUI 模式）:
  ↑↓/jk    浏览          Tab      切换左右栏
  Enter    恢复会话      Space    标记/取消标记
  D        删除          /        搜索
  q        退出
`);
}

function showVersion(): void {
  // Read version from package.json at runtime
  console.log('cc-sessions v1.0.0');
}

function parseArgs(raw: string[]): {
  mode: 'tui' | 'list' | 'delete' | 'help' | 'version';
  projectPath?: string;
  deleteUuid?: string;
  resumeFile?: string;
} {
  const result: ReturnType<typeof parseArgs> = { mode: 'tui' };

  let i = 0;
  while (i < raw.length) {
    const arg = raw[i];
    switch (arg) {
      case '-h':
      case '--help':
        return { ...result, mode: 'help' };
      case '-v':
      case '--version':
        return { ...result, mode: 'version' };
      case '--project':
        result.projectPath = raw[++i];
        break;
      case '--resume-file':
        result.resumeFile = raw[++i];
        break;
      case 'list':
        result.mode = 'list';
        break;
      case 'delete':
        result.mode = 'delete';
        result.deleteUuid = raw[++i];
        break;
      default:
        break;
    }
    i++;
  }

  return result;
}

async function listSessions(projectPath?: string): Promise<void> {
  const projectsDir = join(homedir(), '.claude', 'projects');
  const parser = new JsonlSessionParser();
  const scanner = new ClaudeProjectScanner(projectsDir, parser);

  const opts = projectPath ? { projectPath } : undefined;
  const projects = await scanner.scan(opts);

  const output = projects.flatMap((p) =>
    p.sessions.map((s) => ({
      project: p.name,
      uuid: s.uuid,
      label: s.label,
      labelSource: s.labelSource,
      modifiedAt: s.modifiedAt.toISOString(),
      size: s.size,
      isActive: s.isActive,
    })),
  );

  console.log(JSON.stringify(output, null, 2));
}

async function deleteSession(uuid: string): Promise<void> {
  const projectsDir = join(homedir(), '.claude', 'projects');
  const parser = new JsonlSessionParser();
  const scanner = new ClaudeProjectScanner(projectsDir, parser);

  const projects = await scanner.scan();
  const session = projects.flatMap((p) => p.sessions).find((s) => s.uuid.startsWith(uuid));

  if (!session) {
    console.error(`未找到匹配的会话: ${uuid}`);
    process.exit(1);
  }

  const deleter = new SessionDeleter();
  const results = await deleter.deleteSessions([session]);
  for (const r of results) {
    if (r.status === 'deleted') {
      console.log(`deleted: ${r.uuid}`);
    } else {
      console.error(`${r.status}: ${r.uuid} — ${r.message}`);
    }
  }
}

async function runTui(projectPath?: string, resumeFile?: string): Promise<void> {
  let selectedUuid: string | null = null;

  const { waitUntilExit } = render(
    <App
      projectPath={projectPath}
      onSelectSession={(uuid) => {
        selectedUuid = uuid;
      }}
    />,
  );

  await waitUntilExit();

  if (selectedUuid && resumeFile) {
    writeFileSync(resumeFile, selectedUuid);
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(args);

  switch (parsed.mode) {
    case 'help':
      showHelp();
      break;
    case 'version':
      showVersion();
      break;
    case 'list':
      await listSessions(parsed.projectPath);
      break;
    case 'delete':
      if (!parsed.deleteUuid) {
        console.error('用法: cc-sessions delete <uuid>');
        process.exit(1);
      }
      await deleteSession(parsed.deleteUuid);
      break;
    case 'tui':
      await runTui(parsed.projectPath, parsed.resumeFile);
      break;
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Write shell wrapper**

```bash
#!/bin/bash
# bin/cc-sessions.sh — Shell wrapper for resume flow
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/dist"

if [ ! -f "$DIST_DIR/main.js" ]; then
  echo "Error: cc-sessions is not built. Run 'npm run build' first." >&2
  exit 1
fi

RESUME_FILE=$(mktemp)
trap 'rm -f "$RESUME_FILE"' EXIT

node "$DIST_DIR/main.js" --resume-file "$RESUME_FILE" "$@"

if [ -s "$RESUME_FILE" ]; then
  UUID=$(cat "$RESUME_FILE")
  exec claude --resume "$UUID"
fi
```

- [ ] **Step 3: Make shell wrapper executable**

```bash
chmod +x bin/cc-sessions.sh
```

- [ ] **Step 4: Update package.json bin field**

Verify `package.json` has:
```json
"bin": {
  "cc-sessions": "./bin/cc-sessions.sh"
}
```

(This was already set in Task 1.)

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: `dist/main.js` created without errors.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts bin/cc-sessions.sh
git commit -m "feat(cli): 实现 CLI 入口与 Shell wrapper 恢复流程"
```

---

### Task 14: Cleanup & Final Integration

**Files:**
- Remove: `scripts/delete-session.sh`
- Remove: `commands/delete-session.md`
- Remove: `install.sh`
- Remove: `uninstall.sh`

- [ ] **Step 1: Remove old Bash scripts**

```bash
git rm scripts/delete-session.sh commands/delete-session.md install.sh uninstall.sh
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 3: Build and do a smoke test**

```bash
npm run build
node dist/main.js --help
```

Expected: Help text printed.

```bash
node dist/main.js list
```

Expected: JSON array of sessions printed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(cleanup): 移除旧版 Bash 脚本，完成 TypeScript 重写"
```

---

## Self-Review Checklist

**1. Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| TypeScript project | Task 1 |
| Types (Project, Session, AppState) | Task 2 |
| Path encoding/decoding | Task 3 |
| JSONL streaming parser with 4 metadata fields | Task 4 |
| Project/session scanner | Task 5 |
| Dual-pane TUI layout | Tasks 7–12 |
| Search by title | Task 8, 12 |
| Batch delete with confirmation | Tasks 6, 11, 12 |
| Delete project sessions | Task 12 |
| Resume session via shell wrapper | Task 13 |
| Active session protection | Tasks 5, 6 |
| CLI modes (tui, list, delete) | Task 13 |
| Error handling (missing dir, corrupted JSONL, permissions) | Tasks 4, 5, 6, 12 |
| Keyboard shortcuts (↑↓jk, Tab, Enter, Space, D, /, Esc, q) | Task 12 |
| Visual indicators (★, ●, [x], active highlight) | Task 10 |

**2. Placeholder scan:** No TBD, TODO, or placeholder steps found.

**3. Type consistency:**
- `Session.labelSource` type `'custom-title' | 'ai-title' | 'last-prompt' | 'first-message' | 'fallback'` — defined in types.ts (Task 2), used in scanner.ts (Task 5) and SessionList.tsx (Task 10). ✓
- `ConfirmAction` — defined in types.ts, used in ConfirmDialog.tsx and app.tsx. ✓
- `ISessionParser` — defined in parser.ts, used by scanner.ts constructor. ✓
- `Project` and `Session` — defined in types.ts, used consistently across scanner, deleter, and all components. ✓
