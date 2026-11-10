import type { Session, RawMessage } from './types.js'
import {
  bold, dim, gold, blue, green, grey, purple, cyan, yellow,
  frame, header, divider, fmtTime, W, reset,
} from './colors.js'
import { getPairs, extractText } from './sessions.js'

function wrap(text: string, width: number, indent = ''): string {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (cur.length + w.length + 1 > width) {
      if (cur) lines.push(indent + cur)
      cur = w
    } else {
      cur = cur ? `${cur} ${w}` : w
    }
  }
  if (cur) lines.push(indent + cur)
  return lines.join('\n')
}

function highlightSearch(text: string, search: string): string {
  if (!search) return text
  const re = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, yellow(bold('$1')))
}

function renderContent(text: string, search = ''): string {
  const lines: string[] = []
  for (const line of text.split('\n')) {
    const hl = highlightSearch(line, search)
    if (line.trim().startsWith('```')) {
      lines.push(`  ${purple(line)}`)
    } else if (/^#{1,3} /.test(line)) {
      lines.push(`  ${bold(gold(hl))}`)
    } else if (/^[-*] /.test(line.trim())) {
      lines.push(`  ${cyan(hl)}`)
    } else if (line.trim() === '') {
      lines.push('')
    } else {
      lines.push(wrap(hl, W - 2, '  '))
    }
  }
  return lines.join('\n')
}

function printMsg(role: 'user' | 'assistant', msg: RawMessage, search = '') {
  const icon    = role === 'user' ? blue(bold('▶  You')) : green(bold('◆  Claude'))
  const timeStr = msg.timestamp ? `  ${grey(fmtTime(msg.timestamp))}` : ''
  const text    = extractText(msg.message?.content)

  console.log(`\n  ${icon}${timeStr}`)
  console.log(divider())
  console.log(renderContent(text, search))
}

export function listSessions(sessions: Session[]) {
  console.log()
  console.log(header('  Claude Code  ·  Past Sessions'))
  console.log()
  for (let i = 0; i < sessions.length; i++) {
    const s   = sessions[i]
    const num = gold(bold(`${(i + 1).toString().padStart(2)}.`))
    const ttl = bold(s.title.slice(0, 54).padEnd(54))
    const trn = dim(`${s.turns} turns`)
    const dat = s.lastTs ? grey(fmtTime(s.lastTs)) : ''
    const sid = purple(s.id)
    console.log(`  ${num}  ${ttl}  ${trn}`)
    console.log(`       ${sid}  ${dat}`)
    console.log()
  }
}

export function viewSession(session: Session, search = '') {
  const pairs = getPairs(session)
  const filtered = search
    ? pairs.filter(p =>
        extractText(p.user.message?.content).toLowerCase().includes(search.toLowerCase()) ||
        extractText(p.assistant.message?.content).toLowerCase().includes(search.toLowerCase())
      )
    : pairs

  console.log()
  console.log(header(`  ${session.title.slice(0, 60)}  [${session.id.slice(0, 8)}]`))
  console.log(
    `  ${dim(`${filtered.length} turns · started ${fmtTime(session.firstTs)}`)}\n`
  )

  if (!filtered.length) {
    console.log(`  ${grey('No messages found.')}\n`)
    return
  }

  for (const { user, assistant } of filtered) {
    printMsg('user', user, search)
    printMsg('assistant', assistant, search)
    console.log(`\n  ${frame('═'.repeat(W))}`)
  }
  console.log()
}
