#!/usr/bin/env node
/**
 * claude-past — browse, search, rename and resume Claude Code sessions.
 */

import { spawnSync } from 'child_process'
import { existsSync, realpathSync } from 'fs'
import { loadSessions, filterSessions, resolveSession, saveName } from './sessions.js'
import { listSessions, viewSession } from './display.js'
import { chooseScope, pick } from './picker.js'
import type { Scope } from './picker.js'
import { bold, dim, gold, grey, tildify } from './colors.js'
import type { Session } from './types.js'

const VERSION = '1.2.0'

function help(): void {
  console.log(`
  ${bold(gold('claude-past'))} ${dim('v' + VERSION)}
  Browse, search, rename and resume your Claude Code sessions.

  ${bold('Usage')}
    claude-past                      Interactive picker with live search
    claude-past <words>              Picker, already filtered by those words
    claude-past open <n|id>          Resume a session in Claude Code
    claude-past view <n|id> [-s q]   Print a session's conversation
    claude-past rename <n|id> <name> Give a session your own name
    claude-past list [words]         Plain list (also used when piped)

  ${bold('Which sessions')}
    With no flag, the picker asks: this directory or all directories.
    -d, --here                          Only sessions started in this directory
    -g, --global                        Sessions from every directory
    ${dim('Other commands use every directory unless you pass --here.')}

  ${bold('In the picker')}
    type          search titles, IDs, folders and everything said
    ↑ ↓           move
    Enter         open the session in Claude Code
    Tab           read the conversation
    Ctrl+R        rename
    Ctrl+G        switch between this directory and all directories
    Esc           clear the search, then quit

  ${dim('<n> is the number shown by `list`; <id> is the start of a session ID.')}
`)
}

function fail(message: string): never {
  console.error(`\n  ${gold('!')} ${message}\n`)
  process.exit(1)
}

function find(sessions: Session[], target: string | undefined): Session {
  if (!target) fail('Which session? Give a list number or the start of a session ID.')
  const found = resolveSession(sessions, target)
  if (typeof found === 'string') fail(found)
  return found
}

/** Hand the terminal over to `claude --resume`, in the session's own folder. */
function openInClaude(session: Session): never {
  const cwd = session.cwd && existsSync(session.cwd) ? session.cwd : process.cwd()
  if (session.cwd && cwd !== session.cwd) {
    console.error(`  ${gold('!')} Folder ${tildify(session.cwd)} no longer exists; Claude Code may not find this session.`)
  }
  console.log(`\n  ${dim('Opening')} ${bold(session.title)} ${grey(`in ${tildify(cwd)}`)}\n`)
  // On Windows, `claude` is a .cmd shim that spawnSync can't exec directly
  // without a shell; shell:true is a no-op (and safe) on macOS/Linux.
  const run = spawnSync('claude', ['--resume', session.id], {
    cwd, stdio: 'inherit', shell: process.platform === 'win32',
  })
  if (run.error) {
    fail(`Could not start Claude Code (${run.error.message}). Is the \`claude\` command installed?`)
  }
  process.exit(run.status ?? 0)
}

function rename(session: Session, name: string): void {
  saveName(session.id, name)
  // Reload just this session's title so the change shows immediately.
  const fresh = loadSessions().find(s => s.id === session.id)
  if (fresh) Object.assign(session, { title: fresh.title, customName: fresh.customName, haystack: fresh.haystack })
}

function real(path: string): string {
  try { return realpathSync(path) } catch { return path }
}

async function main(): Promise<void> {
  // Scope flags can appear anywhere; pull them out before reading the command.
  let flag: Scope | undefined
  const args = process.argv.slice(2).filter(a => {
    if (a === '-d' || a === '--here') { flag = 'here'; return false }
    if (a === '-g' || a === '--global' || a === '--all') { flag = 'all'; return false }
    return true
  })
  const cmd = args[0]

  if (cmd === '--help' || cmd === '-h' || cmd === 'help') return help()
  if (cmd === '--version' || cmd === '-v') return console.log(VERSION)

  const all = loadSessions()
  if (!all.length) {
    console.log('\n  No Claude Code sessions found in ~/.claude/projects.\n')
    return
  }
  const dir = real(process.cwd())
  const here = all.filter(s => s.cwd && real(s.cwd) === dir)

  // Non-interactive commands look at every directory unless --here is given.
  const sessions = flag === 'here' ? here : all
  if (flag === 'here' && !here.length && cmd && ['open', 'view', 'rename', 'list'].includes(cmd)) {
    fail(`No sessions were started in ${tildify(dir)}. Drop --here to use all directories.`)
  }

  if (cmd === 'open') return openInClaude(find(sessions, args[1]))

  if (cmd === 'view') {
    const s = find(sessions, args[1])
    const search = args[2] === '-s' ? args.slice(3).join(' ') : ''
    return viewSession(s, search)
  }

  if (cmd === 'rename') {
    const s = find(sessions, args[1])
    const name = args.slice(2).join(' ')
    rename(s, name)
    console.log(name.trim()
      ? `\n  Renamed to ${bold(s.title)}\n`
      : `\n  Custom name removed; title is ${bold(s.title)}\n`)
    return
  }

  if (cmd === 'list') return listSessions(filterSessions(sessions, args.slice(1).join(' ')))

  // Default: interactive picker (plain list when not in a terminal).
  const query = args.join(' ')
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return listSessions(filterSessions(sessions, query))
  }

  // Ask which sessions to show, unless a flag answered it or there is no real choice.
  let scope: Scope | null | undefined = flag
  if (!scope) {
    if (!here.length) {
      scope = 'all'
    } else if (here.length === all.length) {
      scope = 'here'            // every session is from this directory anyway
    } else {
      scope = await chooseScope(here.length, all.length, dir)
      if (!scope) return
    }
  }

  const choice = await pick({ all, here, dir, scope, query, onRename: rename })
  if (!choice) return
  if (choice.action === 'open') openInClaude(choice.session)
  viewSession(choice.session)
}

main().catch(err => fail((err as Error).message))
