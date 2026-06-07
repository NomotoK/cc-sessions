# Claude Code Session Manager TUI — 设计文档

**日期**: 2026-06-04
**版本**: v1 (核心功能)
**状态**: 已确认

---

## 1. 概述

将 cc-sessions 从 Bash 脚本重写为 TypeScript TUI 应用，提供双栏交互式界面管理所有项目的 Claude Code 会话。

### 核心目标

- 统一管理所有项目的会话，支持按项目筛选和删除
- 提供双栏 TUI 交互式界面（左侧项目列表 + 右侧会话列表）
- 选中会话后退出 TUI 并自动启动 `claude --resume`
- 支持批量删除、按标题搜索

### 演进方向

v2 将演进为 Claude Code 内嵌的会话管理器，左侧项目栏复用为类似 yazi 文件管理器的侧边栏。

---

## 2. 技术选型

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 运行方式 | 独立 TUI 应用 | `npm install -g` 后命令行启动 |
| 语言 | TypeScript | 类型安全，OOP 支持好 |
| TUI 框架 | Ink (React-based) | 组件化开发，生态成熟，TypeScript 一等支持 |
| JSONL 解析 | 纯 TS 流式解析 | 零外部依赖，只读前 N 行提取元数据 |
| 会话恢复 | 退出 TUI 后 `claude --resume` | v1 简单直接，v2 演进为 TUI 内接管 |

---

## 3. 项目结构

```
cc-sessions/
├── src/
│   ├── main.ts              # 入口：解析 CLI 参数，启动 TUI
│   ├── app.tsx              # Ink 根组件，双栏布局
│   ├── components/
│   │   ├── ProjectList.tsx  # 左栏：项目列表
│   │   ├── SessionList.tsx  # 右栏：会话列表
│   │   ├── SearchBar.tsx    # 搜索输入框
│   │   ├── ConfirmDialog.tsx# 删除确认弹窗
│   │   └── StatusBar.tsx    # 底部快捷键提示
│   ├── core/
│   │   ├── scanner.ts       # 扫描 ~/.claude/projects/，发现项目和会话
│   │   ├── parser.ts        # JSONL 流式解析，提取元数据
│   │   └── types.ts         # 类型定义
│   └── utils/
│       └── path.ts          # 路径编码/解码（/ → -）
├── bin/
│   └── cc-sessions.sh       # Shell wrapper，处理恢复流程
├── package.json
├── tsconfig.json
└── __tests__/               # 测试目录
    ├── core/
    │   ├── scanner.test.ts
    │   └── parser.test.ts
    └── utils/
        └── path.test.ts
```

---

## 4. 数据模型

```typescript
// core/types.ts

interface Project {
  name: string;                    // 解码后的项目名，如 "accounting-agent"
  encodedPath: string;             // 编码后的路径，如 "-Users-hailin-Code-accounting-agent"
  fullPath: string;                // 完整路径
  sessionCount: number;            // 会话数量
  totalSize: number;               // 总大小（bytes）
}

interface Session {
  uuid: string;                    // 完整 UUID
  project: Project;                // 所属项目引用
  label: string;                   // 显示标题
  labelSource: 'custom-title' | 'ai-title' | 'last-prompt' | 'first-message' | 'fallback';
  modifiedAt: Date;                // 最后修改时间
  size: number;                    // .jsonl 文件大小（bytes）
  isActive: boolean;               // mtime < 10分钟
  artifactDirExists: boolean;      // 是否存在同名衍生目录
}

interface AppState {
  projects: Project[];
  sessions: Session[];
  selectedProjectIndex: number;
  selectedSessionIndex: number;
  markedSessions: Set<string>;
  focusedPane: 'project' | 'session';
  searchQuery: string;
  confirmDialog: ConfirmAction | null;
}
```

### Label 优先级

```
custom-title (★标记) > ai-title > last-prompt > 首条 user 消息 > "Untitled Session"
```

相比现有 Bash 脚本，新增了 `ai-title` 作为备选标题源。

---

## 5. 数据扫描与解析

### Scanner（`scanner.ts`）

```
scanProjects()
  │
  ├─ readdir(~/.claude/projects/)
  │    └─ 过滤目录条目 → encodedPath
  │
  ├─ 对每个项目:
  │    ├─ readdir(projectDir)
  │    ├─ 过滤 *.jsonl → Session 文件
  │    ├─ stat() → mtime + size
  │    └─ 检查同名目录是否存在
  │
  └─ 返回 Project[]，含其 Session[]
```

### Parser（`parser.ts`）

不全量读取 JSONL，只提取元数据：

- 打开文件流，逐行读取
- 收集四类记录：`custom-title`、`ai-title`、`last-prompt`、首条 `user` 消息
- 四个字段都收集到后停止，或最多读前 200 行
- 对于 `last-prompt`（位于文件尾部），当缺少 `custom-title` 和 `ai-title` 时，做一次尾部读取
- 跳过 `<local-command-*>` 包裹的自动注入消息

---

## 6. TUI 界面设计

### 布局

```
┌─ Projects ───────┬─ Sessions: accounting-agent ──── [🔍 搜索] ─┐
│                  │                                               │
│ > accounting-age │ ★ fix-v2-production-stability                │
│   ads-video-age  │   2024-06-03 18:32  23条消息  1.2MB         │
│   cc-sessions    │ ● feat: 企业配置成功消息回调                   │
│   claude-code    │   2024-06-03 15:10  45条消息  3.1MB         │
│                  │   feat: 新税种                                │
│                  │   2024-06-02 14:22  12条消息  0.8MB         │
│                  │                                               │
├──────────────────┴───────────────────────────────────────────────┤
│ ↑↓/jk 浏览  Tab 切换栏  Enter 恢复  Space 标记  D 删除  / 搜索  │
└──────────────────────────────────────────────────────────────────┘
```

**视觉规范**：
- 左栏宽度固定 20 字符
- ★ = custom-title，● = ai-title，无标记 = last-prompt/首条消息
- 活跃会话（< 10 分钟）绿色高亮
- 已标记会话左侧显示 `[x]`，未标记显示 `[ ]`
- 底部 StatusBar 显示当前可用快捷键

### 快捷键

| 按键 | 上下文 | 动作 |
|------|--------|------|
| `↑` / `k` | 任意栏 | 上移光标 |
| `↓` / `j` | 任意栏 | 下移光标 |
| `Tab` | 任意 | 切换焦点：左栏 ↔ 右栏 |
| `Enter` | 右栏 | 退出 TUI 并 `claude --resume <uuid>` |
| `Space` | 右栏 | 切换当前会话标记状态 |
| `D` | 右栏 | 弹出确认对话框，删除已标记会话（或当前会话） |
| `Shift+D` | 左栏 | 弹出确认对话框，删除当前项目下所有会话 |
| `/` | 右栏 | 聚焦搜索栏 |
| `Esc` | 搜索栏/弹窗 | 取消搜索 / 关闭弹窗 |
| `Esc` | 右栏 | 返回左栏 |
| `q` | 任意 | 退出 TUI |

### 确认对话框

```
┌─ 确认删除 ──────────────────────────────┐
│                                          │
│  即将删除 3 个会话：                      │
│                                          │
│  ★ fix-v2-production-stability           │
│  ● feat: 企业配置成功消息回调              │
│    关于部署流程的问题                      │
│                                          │
│  [y] 确认删除    [Esc/N] 取消             │
└──────────────────────────────────────────┘
```

- `y` 执行删除，显示结果后关闭
- `Esc`/`N` 取消
- 活跃会话自动跳过，结果中提示跳过数量

---

## 7. 恢复会话流程

用户按 `Enter` 后：

1. TUI 退出（清理终端状态）
2. 将选中 session UUID 写入 stdout，格式：`RESUME:<uuid>`
3. Shell wrapper 解析 stdout 并执行：

```bash
#!/bin/bash
# bin/cc-sessions.sh
output=$(node dist/main.js "$@")
if [[ "$output" =~ ^RESUME:(.+)$ ]]; then
  exec claude --resume "${BASH_REMATCH[1]}"
fi
```

---

## 8. CLI 接口

```
cc-sessions                    # 启动 TUI（扫描所有项目）
cc-sessions --project <path>   # 只显示指定项目的会话
cc-sessions list               # 非交互模式，输出会话列表（JSON）
cc-sessions delete <uuid>      # 非交互模式，删除指定会话
cc-sessions -h / --help        # 帮助
cc-sessions -v / --version     # 版本
```

---

## 9. 错误处理

| 场景 | 处理 |
|------|------|
| `~/.claude/projects/` 不存在 | 显示空状态 + 提示 |
| JSONL 损坏 | 跳过异常行，不影响其他会话 |
| 删除活跃会话 | 跳过，结果中提示 |
| 文件已不存在 | 静默跳过，从列表移除 |
| 权限不足 | 显示错误，不中断其他删除 |
| 终端宽度 < 60 列 | 显示警告，布局自适应压缩 |

---

## 10. 安全特性（继承自 Bash 版本）

- 活跃会话保护：mtime < 10 分钟拒绝删除
- 删除前确认弹窗
- 删除时同时清理 `.jsonl` 文件和 `<uuid>/` 衍生目录
