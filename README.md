<div align="center">

# cc-sessions

[![Version](https://img.shields.io/npm/v/cc-sessions.svg)](https://www.npmjs.com/package/cc-sessions)

[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](./LICENSE)
[![Language](https://img.shields.io/badge/language-Bash-4EAA25.svg)](https://www.gnu.org/software/bash/)

[**English**](./README.md) | [**中文**](./README_CN.md)

</div>

A terminal UI for managing [Claude Code](https://claude.ai/code) sessions. Browse, search, delete, and resume sessions from an interactive two-pane interface.

## Features

- **Two-pane TUI** — project list on the left, session list on the right
- **Session resume** — select a session and jump straight back into `claude --resume`
- **Smart labels** — session titles resolved from custom title, AI title, last prompt, or first message
- **Search** — filter sessions by label with `/`
- **Batch delete** — mark sessions with `Space`, then delete with `D`; or delete all sessions under a project
- **Active detection** — sessions modified within 10 minutes are flagged as active and protected from deletion
- **JSON output** — `cc-sessions list` prints all sessions as JSON for scripting

<div align="center">
<img width="889" height="663" alt="image" src="https://github.com/user-attachments/assets/d956a999-a201-4b5a-a809-17ba39ddb8b5" />

</div>
## Prerequisites

- Node.js >= 18.0.0
- [Claude Code CLI](https://claude.ai/code) (for session resume)

## Install

```bash
# Clone the repository
git clone <repo-url> cc-sessions
cd cc-sessions

# Install dependencies
npm install

# Build
npm run build
```

## Usage

### TUI Mode (default)

```bash
cc-sessions
```

Launches the interactive terminal interface. Select a session and press `Enter` to resume it in Claude Code.

### List Mode

```bash
cc-sessions list
```

Outputs all sessions as a JSON array. Useful for scripting and automation.

### Delete Mode

```bash
cc-sessions delete <uuid>
```

Deletes a session by UUID prefix. Active sessions are skipped.

### Filter by Project

```bash
cc-sessions --project /path/to/project
cc-sessions list --project /path/to/project
```

### Other Options

```bash
cc-sessions --help       # Show help
cc-sessions --version    # Show version
```

## Keybindings

| Key | Action |
|---|---|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Tab` | Toggle project/session pane |
| `Enter` | Resume selected session (session pane) / Switch to session pane (project pane) |
| `Space` | Mark/unmark session for deletion |
| `D` | Delete marked sessions (session pane) / Delete all project sessions (project pane) |
| `Ctrl+D` | Delete current session or project sessions |
| `/` | Activate search |
| `Esc` | Cancel search / Switch to project pane |
| `q` | Quit |

## How It Works

`cc-sessions` reads session data from `~/.claude/projects/`, where Claude Code stores session files as `.jsonl`. It parses metadata from each file (custom titles, AI-generated titles, prompts) and presents them in an interactive interface.

The shell wrapper (`bin/cc-sessions.sh`) handles session resumption: after the TUI exits, it reads the selected session's project path and UUID from a temp file, then runs `claude --resume <uuid>` in the project directory.

## Development

```bash
npm run dev          # Build in watch mode
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```

## Tech Stack

- [React](https://react.dev/) + [Ink](https://github.com/vadimdemedes/ink) — Terminal UI
- [TypeScript](https://www.typescriptlang.org/) — Language
- [tsup](https://tsup.egoist.dev/) — Build tool
- [Vitest](https://vitest.dev/) — Testing

## License

MIT
