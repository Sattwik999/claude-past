#!/usr/bin/env node
/**
 * claude-past — search, read, rename, resume and delete Claude Code sessions.
 */

import { spawnSync } from 'child_process'
import { existsSync, realpathSync } from 'fs'
import { createInterface } from 'readline'
import {
  loadSessions, filterSessions, resolveSession, saveName,
  deleteSession, emptyTrash, loadTrash, looksActive, restoreSession,
} from './sessions.js'
import { listSessions, viewSession } from './display.js'
import { chooseScope, pick } from './picker.js'
import type { Scope } from './picker.js'
import { bold, dim, gold, grey, tildify } from './colors.js'
import type { Session } from './types.js'

const VERSION = '1.3.0'

function help(): void {
  console.log(`
  ${bold(gold('claude-past'))} ${dim('v' + VERSION)}
  Search, read, rename, resume and delete your Claude Code sessions.

  ${bold('Usage')}
    claude-past                      Interactive picker with live search
    claude-past <words>              Picker, already filtered by those words
    claude-past open <n|id>          Resume a session in Claude Code
    claude-past view <n|id> [-s q]   Print a session's conversation
    claude-past rename <n|id> <name> Give a session your own name
    claude-past list [words]         Plain list (also used when piped)
    claude-past delete <n|id> [-y]   Move a session to the trash
    claude-past trash                List trashed sessions
    claude-past restore <n|id>       Bring a trashed session back
    claude-past trash --empty [-y]   Permanently delete everything in the trash

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
    Ctrl+D        delete (moves to the trash; undo with \`restore\`)
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

const ACTIVE_WARNING = 'Used in the last 2 minutes, so it may be open right now.'

/** Ask a yes/no question on the terminal; anything but y/yes is a no. */
function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) fail('Add -y to confirm when not running in a terminal.')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`\n  ${question} ${dim('[y/N]')} `, answer => {
      rl.close()
      resolve(/^y(es)?$/i.test(answer.trim()))
    })
  })
}

function real(path: string): string {
  try { return realpathSync(path) } catch { return path }
}

async function main(): Promise<void> {
  // Scope flags can appear anywhere; pull them out before reading the command.
  let flag: Scope | undefined
  let yes = false
  const args = process.argv.slice(2).filter(a => {
    if (a === '-d' || a === '--here') { flag = 'here'; return false }
    if (a === '-g' || a === '--global' || a === '--all') { flag = 'all'; return false }
    if (a === '-y' || a === '--yes') { yes = true; return false }
    return true
  })
  const cmd = args[0]

  if (cmd === '--help' || cmd === '-h' || cmd === 'help') return help()
  if (cmd === '--version' || cmd === '-v') return console.log(VERSION)

  // Trash commands work even when no live sessions are left.
  if (cmd === 'trash') {
    const trashed = loadTrash()
    if (!trashed.length) return console.log('\n  The trash is empty.\n')
    if (args.includes('--empty')) {
      if (!yes && !(await confirm(`Permanently delete ${trashed.length} trashed session(s)? This cannot be undone.`))) {
        return console.log('  Nothing deleted.\n')
      }
      emptyTrash()
      return console.log(`\n  Permanently deleted ${trashed.length} session(s).\n`)
    }
    listSessions(trashed, 'Trash')
    console.log(`  ${dim('Bring one back:  claude-past restore <n|id>      Remove for good:  claude-past trash --empty')}\n`)
    return
  }

  if (cmd === 'restore') {
    const s = find(loadTrash(), args[1])
    try { restoreSession(s) } catch (err) { fail((err as Error).message) }
    return console.log(`\n  Restored ${bold(s.title)}\n`)
  }

  const all = loadSessions()
  if (!all.length) {
    console.log('\n  No Claude Code sessions found in ~/.claude/projects.\n')
    return
  }
  const dir = real(process.cwd())
  const here = all.filter(s => s.cwd && real(s.cwd) === dir)

  // Non-interactive commands look at every directory unless --here is given.
  const sessions = flag === 'here' ? here : all
  if (flag === 'here' && !here.length && cmd && ['open', 'view', 'rename', 'list', 'delete'].includes(cmd)) {
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

  if (cmd === 'delete') {
    const s = find(sessions, args[1])
    if (looksActive(s) && !yes) fail(`${ACTIVE_WARNING} Add -y to delete it anyway.`)
    if (!yes && !(await confirm(`Move "${s.title}" (${s.turns.length} turns) to the trash?`))) {
      return console.log('  Nothing deleted.\n')
    }
    deleteSession(s)
    console.log(`\n  Moved ${bold(s.title)} to the trash.`)
    console.log(`  ${dim(`Undo:  claude-past restore ${s.id.slice(0, 8)}`)}\n`)
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

  const choice = await pick({
    all, here, dir, scope, query,
    onRename: rename,
    onDelete: s => {
      if (looksActive(s)) return `${ACTIVE_WARNING} Close it first.`
      try { deleteSession(s) } catch (err) { return `Could not delete: ${(err as Error).message}` }
    },
  })
  if (!choice) return
  if (choice.action === 'open') openInClaude(choice.session)
  viewSession(choice.session)
}

main().catch(err => fail((err as Error).message))
