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

      if (session.artifactDirExists) {
        const artifactDir = join(session.project.fullPath, session.uuid);
        try {
          await rm(artifactDir, { recursive: true, force: true });
        } catch {
          // Non-fatal: artifact directory cleanup is best-effort
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
