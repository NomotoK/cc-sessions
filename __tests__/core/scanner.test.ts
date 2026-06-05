import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeProjectScanner } from '../../src/core/scanner.js';
import { JsonlSessionParser } from '../../src/core/parser.js';
import type { ISessionParser } from '../../src/core/parser.js';

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
    const missingScanner = new ClaudeProjectScanner(join(tempDir, 'nonexistent'), new JsonlSessionParser());
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
    await mkdir(join(projectDir, 'aaa11111-2222-3333-4444-555566667777'));
    await writeFile(join(projectDir, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);
    await writeFile(join(projectDir, 'notes.txt'), 'not a session');

    const projects = await scanner.scan();

    expect(projects[0].sessionCount).toBe(1);
  });

  it('detects artifact directories for sessions', async () => {
    const projectDir = join(tempDir, '-Users-test-myproject');
    await mkdir(projectDir);
    await mkdir(join(projectDir, 'aaa11111-2222-3333-4444-555566667777'));
    await writeFile(join(projectDir, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);

    const projects = await scanner.scan();

    expect(projects[0].sessions[0].artifactDirExists).toBe(true);
  });

  it('sorts projects by name and sessions by modifiedAt desc', async () => {
    const projectDir = join(tempDir, '-Users-test-myproject');
    await mkdir(projectDir);
    await writeFile(join(projectDir, 'aaa11111-2222-3333-4444-555566667777.jsonl'), customTitleJsonl);
    await new Promise((r) => setTimeout(r, 50));
    await writeFile(join(projectDir, 'bbb22222-3333-4444-5555-666677778888.jsonl'), aiTitleJsonl);

    const projects = await scanner.scan();

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
