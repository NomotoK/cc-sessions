import { describe, it, expect } from 'vitest';
import { JsonlSessionParser } from '../../src/core/parser.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '..', 'fixtures');

describe('JsonlSessionParser', () => {
  const parser = new JsonlSessionParser();

  it('extracts custom-title as highest priority label', async () => {
    const meta = await parser.parseMetadata(path.join(fixtures, 'custom-title-session.jsonl'));
    expect(meta.customTitle).toBe('我的自定义标题');
    expect(meta.aiTitle).toBe('AI 生成的标题');
    expect(meta.firstUserMessage).toBe('这是一条用户消息');
  });

  it('extracts ai-title when custom-title is absent', async () => {
    const meta = await parser.parseMetadata(path.join(fixtures, 'ai-title-session.jsonl'));
    expect(meta.customTitle).toBeNull();
    expect(meta.aiTitle).toBe('AI 自动标题');
  });

  it('extracts first user message, skipping wrappers', async () => {
    const meta = await parser.parseMetadata(path.join(fixtures, 'no-title-session.jsonl'));
    expect(meta.firstUserMessage).toBe('用户的实际问题');
  });

  it('returns nulls for session with no user content', async () => {
    const meta = await parser.parseMetadata(path.join(fixtures, 'empty-session.jsonl'));
    expect(meta.customTitle).toBeNull();
    expect(meta.aiTitle).toBeNull();
    expect(meta.lastPrompt).toBeNull();
    expect(meta.firstUserMessage).toBeNull();
  });

  it('reads last-prompt from file tail', async () => {
    const meta = await parser.parseMetadata(path.join(fixtures, 'no-title-session.jsonl'));
    expect(meta.lastPrompt).toBe('最后的用户消息');
  });

  it('handles user content as string', async () => {
    const meta = await parser.parseMetadata(path.join(fixtures, 'custom-title-session.jsonl'));
    expect(meta.firstUserMessage).toBe('这是一条用户消息');
  });

  it('handles user content as array of text blocks', async () => {
    const meta = await parser.parseMetadata(path.join(fixtures, 'no-title-session.jsonl'));
    expect(meta.lastPrompt).toBe('最后的用户消息');
  });
});
