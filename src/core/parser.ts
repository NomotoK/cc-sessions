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

      if (record.type === 'custom-title' && typeof record.customTitle === 'string') {
        result.customTitle = record.customTitle;
      } else if (record.type === 'ai-title' && typeof record.aiTitle === 'string') {
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
      for (let i = tailLines.length - 1; i >= 0; i--) {
        const record = this.safeParse(tailLines[i]);
        if (record?.type === 'last-prompt' && typeof record.lastPrompt === 'string') {
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
      stream.on('data', (chunk: string | Buffer) => {
        const str = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
        buffer += str;
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
    const content = (record.message as Record<string, unknown>)?.content;
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
