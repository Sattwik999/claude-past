# claude-past

An unofficial tool to browse, search, rename and resume your [Claude Code](https://claude.com/claude-code) sessions from the terminal.

Claude Code saves every conversation on your machine. `claude-past` gives you a full-screen picker over all of them: type to search everything that was said, press Enter, and you are back inside that session in Claude Code.

## Features

- **Live search** across titles, session IDs, folders and the full text of every conversation, with a matching excerpt under each result
- **Enter opens the session in Claude Code** (`claude --resume`), in the folder it was started in
- **Rename sessions** with your own names; Claude Code's files are never modified
- **Read a transcript** without resuming it, optionally filtered to the turns that mention a word
- **This directory or everywhere**: the picker asks which you want, and `Ctrl+G` switches at any time
- **Zero runtime dependencies**

## Install

```bash
npm install -g @sattwik999/claude-past
```

Requires Node.js 18 or newer and Claude Code.

## Usage

```bash
claude-past                       # interactive picker
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

When the directory you are in has sessions of its own and there are others elsewhere, the picker first asks which to show. Skip the question with a flag:

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

Claude Code stores each session as a `.jsonl` file under `~/.claude/projects/`. `claude-past` reads those files and never writes to them. Custom names are kept separately in `~/.config/claude-past/names.json`.

Titles come from, in order: your custom name, the title Claude Code generated, the first prompt.

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
