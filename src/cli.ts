#!/usr/bin/env node
/**
 * claude-history  —  Browse and search your Claude Code sessions from the CLI
 *
 * Usage:
 *   claude-history              List sessions + interactive picker
 *   claude-history <n>          View session by number
 *   claude-history <id>         View session by (partial) ID
 *   claude-history <n> -s <q>  Search within session
 *   claude-history --help       Show help
 */

import { loadSessions } from './sessions.js'
import { listSessions, viewSession } from './display.js'
import { pick } from './picker.js'
import { gold, bold, dim, grey } from './colors.js'

function printHelp() {
  console.log(`
  ${bold(gold('claude-history'))}  ${dim('v1.0.0')}
  Browse and search your Claude Code terminal sessions

  ${bold('Usage')}
    claude-history                   List all sessions + interactive picker
    claude-history <number>          Open session by list number
    claude-history <id>              Open session by (partial) session ID
    claude-history <n> -s <query>    Search within a session

  ${bold('Examples')}
    claude-history                   # interactive list
    claude-history 1                 # open most recent session
    claude-history c7b4              # open by partial ID
    claude-history 2 -s kitty        # search "kitty" in session 2

  ${bold('Shortcuts')}
    ch                               # alias for claude-history
  `)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  let sessions
  try {
    sessions = loadSessions()
  } catch (err) {
    console.error(`\n  ${gold('!')} Could not read Claude sessions: ${(err as Error).message}\n`)
    process.exit(1)
  }

  if (!sessions.length) {
    console.log('\n  No Claude Code sessions found.\n')
    process.exit(0)
  }

  // No args → list + interactive picker
  if (!args.length) {
    listSessions(sessions)

    const idx = await pick(
      sessions.map(s => ({
        label: `${s.title.slice(0, 54)}  ${grey(`${s.turns} turns`)}`,
        sub: s.id,
      })),
      'Select a session'
    )

    if (idx !== null) {
      console.clear()
      viewSession(sessions[idx])
    }
    return
  }

  // Resolve session target
  const target = args[0]
  let searchQuery = ''
  if (args[1] === '-s' && args[2]) searchQuery = args[2]

  // by number
  if (/^\d+$/.test(target)) {
    const idx = parseInt(target, 10) - 1
    if (idx < 0 || idx >= sessions.length) {
      console.error(`\n  No session #${target}  (${sessions.length} available)\n`)
      process.exit(1)
    }
    viewSession(sessions[idx], searchQuery)
    return
  }

  // by partial ID
  const matches = sessions.filter(
    s => s.id.startsWith(target) || s.id.includes(target)
  )
  if (matches.length === 1) {
    viewSession(matches[0], searchQuery)
  } else if (matches.length > 1) {
    console.log('\n  Multiple matches — be more specific:\n')
    matches.forEach(m => console.log(`    ${m.id}  ${m.title.slice(0, 50)}`))
    console.log()
  } else {
    console.error(`\n  Session '${target}' not found. Run claude-history to list all.\n`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n  Error:', err.message)
  process.exit(1)
})
