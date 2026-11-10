# claude-history

> Browse and search your [Claude Code](https://claude.ai/code) terminal sessions from the CLI — with a beautiful interactive picker, full conversation view, and search.

![demo](https://img.shields.io/badge/terminal-kitty-blueviolet) ![npm](https://img.shields.io/npm/v/claude-history) ![license](https://img.shields.io/badge/license-MIT-green)

## Features

- 📋 **List all sessions** with titles, turn counts and timestamps
- ⌨️  **Arrow-key picker** — navigate and open sessions without typing an ID
- 🔍 **Search within sessions** — highlight matching turns
- 🎨 **24-bit TrueColor** — gold, blue, purple, pink — looks great on Kitty, iTerm2, WezTerm
- **Zero runtime dependencies** — pure Node.js, no external packages

## Install

```bash
npm install -g claude-history
```

Or with pnpm / bun:

```bash
pnpm add -g claude-history
bun add -g claude-history
```

## Usage

```bash
# Interactive list + arrow-key picker
claude-history

# Short alias
ch

# Open session by number
claude-history 1

# Open session by (partial) ID
claude-history c7b4

# Search within a session
claude-history 2 -s kitty

# Help
claude-history --help
```

## Keyboard shortcuts in picker

| Key | Action |
|-----|--------|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Enter` | Open selected session |
| `q` / `Ctrl+C` | Quit |

## How it works

Claude Code stores every conversation as a `.jsonl` file in `~/.claude/projects/`.  
`claude-history` reads those files, pairs up user and assistant messages, and renders them with color and formatting.

## Requirements

- Node.js ≥ 18
- [Claude Code](https://claude.ai/code) installed and used at least once

## Contributing

PRs welcome! Open an issue first for large changes.

```bash
git clone https://github.com/sattwik/claude-history
cd claude-history
npm install
npm run dev        # run from source with tsx
npm run build      # compile TypeScript
```

## Author

**Sattwik Sarkar** — built with [Claude Code](https://claude.ai/code)

## License

MIT © Sattwik Sarkar
