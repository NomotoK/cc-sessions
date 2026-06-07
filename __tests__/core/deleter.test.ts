import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionDeleter } from '../../src/core/deleter.js';
import type { Session, Project, LabelSource } from '../../src/core/types.js';

/** Set file mtime to 20 minutes ago so it is not considered active */
async function makeOld(filePath: string): Promise<void> {
  const oldTime = new Date(Date.now() - 20 * 60 * 1000);
  await utimes(filePath, oldTime, oldTime);
}

function makeSession(
  uuid: string,
  projectFullPath: string,
  artifactDirExists = false,
): Session {
  const project: Project = {
    name: 'test-project',
    encodedPath: '-Users-test-test-project',
    fullPath: projectFullPath,
    sessionCount: 1,
    totalSize: 100,
  };
  return {
    uuid,
    project,
    label: 'test label',
    labelSource: 'custom-title' as LabelSource,
    modifiedAt: new Date(),
    size: 100,
    isActive: false,
    artifactDirExists,
  };
}

describe('SessionDeleter', () => {
  let tempDir: string;
  let deleter: SessionDeleter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cc-sessions-del-'));
    deleter = new SessionDeleter();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('deletes a session jsonl file successfully', async () => {
    const uuid = 'aaa11111-2222-3333-4444-555566667777';
    const filePath = join(tempDir, `${uuid}.jsonl`);
    await writeFile(filePath, 'some content');
    await makeOld(filePath);

    const session = makeSession(uuid, tempDir);
    const results = await deleter.deleteSessions([session]);

    expect(results).toHaveLength(1);
    expect(results[0].uuid).toBe(uuid);
    expect(results[0].status).toBe('deleted');
    expect(results[0].message).toBe('已删除');

    // Verify file is actually gone
    await expect(stat(filePath)).rejects.toThrow();
  });

  it('skips active sessions (modified within 10 minutes)', async () => {
    const uuid = 'bbb22222-3333-4444-5555-666677778888';
    const filePath = join(tempDir, `${uuid}.jsonl`);
    await writeFile(filePath, 'active content');

    const session = makeSession(uuid, tempDir);
    const results = await deleter.deleteSessions([session]);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('skipped-active');
    expect(results[0].message).toContain('活跃会话');

    // Verify file still exists
    const fileStat = await stat(filePath);
    expect(fileStat).toBeDefined();
  });

  it('reports error when session file does not exist', async () => {
    const uuid = 'ccc33333-4444-5555-6666-777788889999';
    const session = makeSession(uuid, tempDir);

    const results = await deleter.deleteSessions([session]);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('error');
    expect(results[0].message).toBe('文件不存在');
  });

  it('deletes artifact directory when artifactDirExists is true', async () => {
    const uuid = 'ddd44444-5555-6666-7777-888899990000';
    const filePath = join(tempDir, `${uuid}.jsonl`);
    const artifactDir = join(tempDir, uuid);
    await writeFile(filePath, 'old content');
    await mkdir(artifactDir);
    await writeFile(join(artifactDir, 'artifact.txt'), 'some artifact');

    // Make the file old enough to not be considered active
    await makeOld(filePath);

    const session = makeSession(uuid, tempDir, true);
    const results = await deleter.deleteSessions([session]);

    expect(results[0].status).toBe('deleted');
    // Verify artifact dir is gone
    await expect(stat(artifactDir)).rejects.toThrow();
  });

  it('handles multiple sessions in a single call', async () => {
    const uuid1 = 'eee55555-6666-7777-8888-999900001111';
    const uuid2 = 'fff66666-7777-8888-9999-000011112222';
    await writeFile(join(tempDir, `${uuid1}.jsonl`), 'content 1');
    await writeFile(join(tempDir, `${uuid2}.jsonl`), 'content 2');

    // Make uuid2 old enough
    await makeOld(join(tempDir, `${uuid2}.jsonl`));

    const session1 = makeSession(uuid1, tempDir); // active
    const session2 = makeSession(uuid2, tempDir); // old enough

    const results = await deleter.deleteSessions([session1, session2]);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.uuid === uuid1)!.status).toBe('skipped-active');
    expect(results.find((r) => r.uuid === uuid2)!.status).toBe('deleted');
  });

  it('returns empty array for empty input', async () => {
    const results = await deleter.deleteSessions([]);
    expect(results).toEqual([]);
  });
});
