import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Project, Session, SessionMetadata, LabelSource } from './types.js';
import type { ISessionParser } from './parser.js';
import { PathEncoder } from '../utils/path.js';

const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export interface ProjectWithSessions extends Project {
  sessions: Session[];
}

export interface ScanOptions {
  projectPath?: string;
}

export class ClaudeProjectScanner {
  constructor(
    private readonly projectsDir: string,
    private readonly parser: ISessionParser,
  ) {}

  async scan(options?: ScanOptions): Promise<ProjectWithSessions[]> {
    let entries: string[];
    try {
      entries = await readdir(this.projectsDir);
    } catch {
      return [];
    }

    // If a specific project path is given, filter to that encoded path only
    let targetEncodedPath: string | undefined;
    if (options?.projectPath) {
      targetEncodedPath = PathEncoder.encode(options.projectPath);
    }

    const results: ProjectWithSessions[] = [];

    for (const entry of entries) {
      const entryPath = join(this.projectsDir, entry);

      let entryStat;
      try {
        entryStat = await stat(entryPath);
      } catch {
        continue;
      }

      if (!entryStat.isDirectory()) continue;

      // If filtering by project path, skip non-matching
      if (targetEncodedPath !== undefined && entry !== targetEncodedPath) {
        continue;
      }

      const projectResult = await this.scanProject(entry, entryPath);
      if (projectResult) {
        results.push(projectResult);
      }
    }

    // Sort projects by name
    results.sort((a, b) => a.name.localeCompare(b.name));

    // Sort sessions by modifiedAt desc within each project
    for (const project of results) {
      project.sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    }

    return results;
  }

  private async scanProject(
    encodedPath: string,
    projectPath: string,
  ): Promise<ProjectWithSessions | null> {
    let files: string[];
    try {
      files = await readdir(projectPath);
    } catch {
      return null;
    }

    // Filter for .jsonl files only
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) {
      return null;
    }

    // Also collect all directory names for artifact detection
    const dirNames = new Set<string>();
    for (const f of files) {
      const fPath = join(projectPath, f);
      try {
        const fStat = await stat(fPath);
        if (fStat.isDirectory()) {
          dirNames.add(f);
        }
      } catch {
        // ignore
      }
    }

    const sessions: Session[] = [];
    let totalSize = 0;

    for (const jsonlFile of jsonlFiles) {
      const uuid = jsonlFile.replace('.jsonl', '');
      const filePath = join(projectPath, jsonlFile);

      let fileStat;
      try {
        fileStat = await stat(filePath);
      } catch {
        continue;
      }

      totalSize += fileStat.size;

      // Parse metadata from the JSONL file
      let metadata: SessionMetadata;
      try {
        metadata = await this.parser.parseMetadata(filePath);
      } catch {
        metadata = {
          customTitle: null,
          aiTitle: null,
          lastPrompt: null,
          firstUserMessage: null,
        };
      }

      // Resolve label with priority chain
      const { label, labelSource } = this.resolveLabel(metadata);

      // Check for artifact directory
      const artifactDirExists = dirNames.has(uuid);

      // Determine if session is active (modified within last 10 minutes)
      const isActive = Date.now() - fileStat.mtimeMs < ACTIVE_THRESHOLD_MS;

      const project: Project = {
        name: PathEncoder.extractProjectName(encodedPath),
        encodedPath,
        fullPath: projectPath,
        sessionCount: 0, // will be set later
        totalSize: 0, // will be set later
      };

      sessions.push({
        uuid,
        project,
        label,
        labelSource,
        modifiedAt: fileStat.mtime,
        size: fileStat.size,
        isActive,
        artifactDirExists,
      });
    }

    if (sessions.length === 0) {
      return null;
    }

    // Set the correct sessionCount and totalSize on the project
    const projectData: Project = {
      name: PathEncoder.extractProjectName(encodedPath),
      encodedPath,
      fullPath: projectPath,
      sessionCount: sessions.length,
      totalSize,
    };

    // Update all sessions to point to the complete project data
    for (const session of sessions) {
      session.project = projectData;
    }

    return {
      ...projectData,
      sessions,
    };
  }

  private resolveLabel(metadata: SessionMetadata): { label: string; labelSource: LabelSource } {
    if (metadata.customTitle) {
      return { label: metadata.customTitle, labelSource: 'custom-title' };
    }
    if (metadata.aiTitle) {
      return { label: metadata.aiTitle, labelSource: 'ai-title' };
    }
    if (metadata.lastPrompt) {
      return { label: metadata.lastPrompt, labelSource: 'last-prompt' };
    }
    if (metadata.firstUserMessage) {
      return { label: metadata.firstUserMessage, labelSource: 'first-message' };
    }
    return { label: '(无标题)', labelSource: 'fallback' };
  }
}
