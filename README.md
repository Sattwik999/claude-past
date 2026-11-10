# claude-past

> *"Which session was it where I fixed the tab colors?"* — find it by what was said, not by scrolling.

An unofficial, full-text search engine for your [Claude Code](https://claude.com/claude-code) history. `claude-past` searches the actual words in every past conversation — not just titles — and resumes the one you pick exactly where you left it.

Claude Code's own `claude --resume` shows a picker, but it only matches against session titles. `claude-past` searches everything that was ever typed or said, across every project folder, and shows you the matching line before you open it.

## Features

- **Full-text search** — not just titles. Type a word you remember saying, and every session that mentions it shows up with the matching line
- **Enter resumes the session in Claude Code** (`claude --resume`), in the folder it was started in
- **Read before you commit** — `Tab` shows the transcript without resuming
- **Rename sessions** with your own names, stored separately; Claude Code's own files are never touched
- **This directory or everywhere** — scope to where you're standing, or search your whole history; `Ctrl+G` switches either way
- **Zero runtime dependencies** — fast to install, nothing to break

## Install

```bash
npm install -g @sattwik999/claude-past
```

Requires Node.js 18+ and Claude Code. Tested on macOS and Linux; on Windows, resuming a session shells out through `cmd.exe` and is less tested — [open an issue](https://github.com/Sattwik999/claude-past/issues) if it misbehaves.

## Usage

```bash
claude-past                       # interactive picker — just start typing to search
claude-past kitty theme           # picker, already filtered
claude-past open 1                # resume the most recent session
claude-past open c7b4             # resume by the start of a session ID
claude-past view 2                # print a conversation
claude-past view 2 -s background  # only the turns that mention "background"
claude-past rename 2 "Kitty setup"
claude-past rename 2 ""           # back to the original title
claude-past list                  # plain list, good for piping
```

`cpa` is installed as a short alias for `claude-past`.

### This directory or all directories

When the directory you're in has sessions of its own and there are others elsewhere, the picker asks which to show first. Skip the question with a flag:

```bash
claude-past --here      # or -d: only sessions started in this directory
claude-past --global    # or -g: sessions from every directory
```

`open`, `view`, `rename` and `list` use every directory unless you pass `--here`.

### Keys in the picker

| Key | Action |
|-----|--------|
| type | Search |
| `↑` `↓` | Move |
| `Enter` | Open the session in Claude Code |
| `Tab` | Read the conversation |
| `Ctrl+R` | Rename |
| `Ctrl+G` | Switch between this directory and all directories |
| `Ctrl+U` | Clear the search |
| `Esc` | Clear the search, then quit |

## How it works

Claude Code stores each session as a `.jsonl` file under `~/.claude/projects/`. `claude-past` reads those files and never writes to them — it's a read-only view on top of what's already there.

Titles come from, in order: your custom name (if you set one with `rename`), the title Claude Code generated for it, or the first prompt.

> **Note:** names you set with `claude-past rename` live in `~/.config/claude-past/names.json` and are separate from anything Claude Code itself tracks — so a rename here won't show up in Claude Code's own `--resume` picker, and vice versa.

> **Note:** this reads Claude Code's internal session file format, which isn't a documented public API and may change between Claude Code versions. If `claude-past` stops finding sessions after a Claude Code update, please [open an issue](https://github.com/Sattwik999/claude-past/issues).

## Development

```bash
git clone https://github.com/Sattwik999/claude-past.git
cd claude-past
npm install
npm run dev      # run from source
npm run build    # compile to dist/
```

## License

MIT © Sattwik Sarkar
