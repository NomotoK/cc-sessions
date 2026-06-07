<div align="center">

# cc-sessions

[![Version](https://img.shields.io/npm/v/cc-sessions.svg)](https://www.npmjs.com/package/cc-sessions)

[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](./LICENSE)
[![Language](https://img.shields.io/badge/language-Bash-4EAA25.svg)](https://www.gnu.org/software/bash/)

[**English**](./README.md) | [**中文**](./README_CN.md)

</div>


一个用于管理 [Claude Code](https://claude.ai/code) 会话的终端界面工具。通过交互式双栏界面浏览、搜索、删除和恢复会话。

## 功能

- **双栏 TUI** — 左侧项目列表，右侧会话列表
- **会话恢复** — 选择会话后自动执行 `claude --resume` 恢复对话
- **智能标签** — 按自定义标题、AI 标题、最后提示词、首条消息的优先级解析会话标题
- **搜索过滤** — 使用 `/` 按标签过滤会话
- **批量删除** — 用 `Space` 标记会话后按 `D` 删除；也可一键删除项目下所有会话
- **活跃检测** — 10 分钟内有修改的会话标记为活跃，删除时自动跳过
- **JSON 输出** — `cc-sessions list` 以 JSON 格式输出所有会话，便于脚本集成

## 前置条件

- Node.js >= 18.0.0
- [Claude Code CLI](https://claude.ai/code)（用于恢复会话）

## 安装

```bash
# 克隆仓库
git clone <repo-url> cc-sessions
cd cc-sessions

# 安装依赖
npm install

# 构建
npm run build
```

## 使用方法

### TUI 模式（默认）

```bash
cc-sessions
```

启动交互式终端界面。选择会话后按 `Enter` 即可在 Claude Code 中恢复该会话。

### 列表模式

```bash
cc-sessions list
```

以 JSON 数组格式输出所有会话，适合脚本和自动化场景。

### 删除模式

```bash
cc-sessions delete <uuid>
```

通过 UUID 前缀删除指定会话。活跃会话会被自动跳过。

### 按项目过滤

```bash
cc-sessions --project /path/to/project
cc-sessions list --project /path/to/project
```

### 其他选项

```bash
cc-sessions --help       # 显示帮助
cc-sessions --version    # 显示版本号
```

## 快捷键

| 按键 | 功能 |
|---|---|
| `↑` / `k` | 上移 |
| `↓` / `j` | 下移 |
| `Tab` | 切换项目/会话面板 |
| `Enter` | 恢复选中会话（会话面板）/ 切换到会话面板（项目面板） |
| `Space` | 标记/取消标记会话（用于删除） |
| `D` | 删除已标记的会话（会话面板）/ 删除项目全部会话（项目面板） |
| `Ctrl+D` | 删除当前会话或项目全部会话 |
| `/` | 激活搜索 |
| `Esc` | 取消搜索 / 切换到项目面板 |
| `q` | 退出 |

## 工作原理

`cc-sessions` 读取 `~/.claude/projects/` 目录下的会话数据，Claude Code 将会话存储为 `.jsonl` 文件。工具解析每个文件的元数据（自定义标题、AI 生成标题、提示词等），并以交互式界面呈现。

Shell 包装脚本（`bin/cc-sessions.sh`）负责会话恢复：TUI 退出后，从临时文件读取所选会话的项目路径和 UUID，然后在项目目录中执行 `claude --resume <uuid>`。

## 开发

```bash
npm run dev          # 监听模式构建
npm test             # 运行测试
npm run test:watch   # 监听模式运行测试
```

## 技术栈

- [React](https://react.dev/) + [Ink](https://github.com/vadimdemedes/ink) — 终端界面
- [TypeScript](https://www.typescriptlang.org/) — 开发语言
- [tsup](https://tsup.egoist.dev/) — 构建工具
- [Vitest](https://vitest.dev/) — 测试框架

## 许可证

MIT
