import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ClaudeProjectScanner } from './core/scanner.js';
import { JsonlSessionParser } from './core/parser.js';
import { SessionDeleter } from './core/deleter.js';

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };
const VERSION = pkg.version;

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const HELP = `
cc-sessions v${VERSION} - Claude Code 会话管理器

用法:
  cc-sessions                  启动 TUI 交互界面
  cc-sessions list             列出所有会话 (JSON 格式)
  cc-sessions delete <uuid>    删除指定会话
  cc-sessions --project <path> 按项目路径过滤
  cc-sessions --help           显示帮助信息
  cc-sessions --version        显示版本号

内部选项:
  --resume-file <path>         指定恢复文件路径 (由 shell wrapper 使用)

TUI 快捷键:
  ↑/k, ↓/j       上下浏览
  Tab             切换项目/会话面板
  Enter           恢复选中的会话
  Space           标记/取消标记会话
  D               删除 (会话面板: 标记项; 项目面板: 项目全部)
  /               搜索会话
  q               退出
`.trim();

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  mode: 'tui' | 'list' | 'delete' | 'help' | 'version';
  projectPath?: string;
  resumeFile?: string;
  deleteUuid?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // drop node + script
  const result: ParsedArgs = { mode: 'tui' };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      result.mode = 'help';
      break;
    }

    if (arg === '-v' || arg === '--version') {
      result.mode = 'version';
      break;
    }

    if (arg === 'list') {
      result.mode = 'list';
      i++;
      continue;
    }

    if (arg === 'delete') {
      result.mode = 'delete';
      i++;
      if (i < args.length) {
        result.deleteUuid = args[i];
      }
      i++;
      continue;
    }

    if (arg === '--project') {
      i++;
      if (i < args.length) {
        result.projectPath = args[i];
      }
      i++;
      continue;
    }

    if (arg === '--resume-file') {
      i++;
      if (i < args.length) {
        result.resumeFile = args[i];
      }
      i++;
      continue;
    }

    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Scanner helper
// ---------------------------------------------------------------------------

function createScanner(projectPath?: string): {
  scanner: ClaudeProjectScanner;
} {
  const projectsDir = join(homedir(), '.claude', 'projects');
  const parser = new JsonlSessionParser();
  const scanner = new ClaudeProjectScanner(projectsDir, parser);
  return { scanner };
}

// ---------------------------------------------------------------------------
// List mode
// ---------------------------------------------------------------------------

async function runList(projectPath?: string): Promise<void> {
  const { scanner } = createScanner(projectPath);
  const projects = await scanner.scan({ projectPath });

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

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Delete mode
// ---------------------------------------------------------------------------

async function runDelete(uuid: string, projectPath?: string): Promise<void> {
  const { scanner } = createScanner(projectPath);
  const projects = await scanner.scan({ projectPath });

  // Find session by UUID prefix
  const allSessions = projects.flatMap((p) => p.sessions);
  const matches = allSessions.filter((s) => s.uuid.startsWith(uuid));

  if (matches.length === 0) {
    process.stderr.write(`错误: 未找到 UUID 以 "${uuid}" 开头的会话\n`);
    process.exit(1);
  }

  if (matches.length > 1) {
    process.stderr.write(
      `错误: UUID 前缀 "${uuid}" 匹配到多个会话:\n` +
        matches.map((s) => `  ${s.uuid} - ${s.label}`).join('\n') +
        '\n',
    );
    process.exit(1);
  }

  const deleter = new SessionDeleter();
  const results = await deleter.deleteSessions(matches);

  for (const result of results) {
    if (result.status === 'deleted') {
      process.stdout.write(`已删除会话 ${result.uuid}\n`);
    } else {
      process.stderr.write(`${result.uuid}: ${result.message}\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// TUI mode
// ---------------------------------------------------------------------------

async function runTui(projectPath?: string, resumeFile?: string): Promise<void> {
  let selectedUuid: string | null = null;

  const { waitUntilExit } = render(
    React.createElement(App, {
      projectPath,
      onSelectSession: (uuid: string) => {
        selectedUuid = uuid;
      },
    }),
  );

  await waitUntilExit();

  if (selectedUuid && resumeFile) {
    writeFileSync(resumeFile, selectedUuid);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  switch (parsed.mode) {
    case 'help':
      process.stdout.write(HELP + '\n');
      break;

    case 'version':
      process.stdout.write(`cc-sessions v${VERSION}\n`);
      break;

    case 'list':
      await runList(parsed.projectPath);
      break;

    case 'delete': {
      if (!parsed.deleteUuid) {
        process.stderr.write('错误: 请指定要删除的会话 UUID\n');
        process.exit(1);
      }
      await runDelete(parsed.deleteUuid, parsed.projectPath);
      break;
    }

    case 'tui':
      await runTui(parsed.projectPath, parsed.resumeFile);
      break;
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `致命错误: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
