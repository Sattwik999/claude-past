import type { Session } from './types.js'
import {
  bold, dim, gold, blue, green, grey, purple, cyan, yellow, frame,
  fit, fmtShort, fmtTime, tildify, width,
} from './colors.js'

function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(' ')) {
    if (cur && cur.length + word.length + 1 > max) {
      lines.push(cur)
      cur = word
    } else {
      cur = cur ? `${cur} ${word}` : word
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function highlight(text: string, search: string): string {
  if (!search) return text
  const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return text.replace(re, m => yellow(bold(m)))
}

function renderBody(text: string, search: string, max: number): string {
  const out: string[] = []
  let inCode = false
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode
      out.push(`  ${purple(line)}`)
    } else if (inCode) {
      out.push(`  ${purple(highlight(line, search))}`)
    } else if (/^#{1,4} /.test(line)) {
      out.push(`  ${bold(gold(line))}`)
    } else if (line.trim() === '') {
      out.push('')
    } else {
      const paint = /^\s*[-*] /.test(line) ? cyan : (s: string) => s
      for (const l of wrap(line, max)) out.push(`  ${paint(highlight(l, search))}`)
    }
  }
  return out.join('\n')
}

/** Plain numbered list (used when output is piped, and by `list`). */
export function listSessions(sessions: Session[]): void {
  const w = width()
  const titleW = w - 34
  console.log()
  console.log(`  ${bold(gold('Claude Code sessions'))}  ${grey(String(sessions.length))}`)
  console.log(`  ${frame('─'.repeat(w))}`)
  sessions.forEach((s, i) => {
    const num = gold(bold(String(i + 1).padStart(2) + '.'))
    const turns = dim(`${s.turns.length} turns`.padStart(9))
    console.log(`  ${num} ${bold(fit(s.title, titleW))} ${turns}  ${grey(fmtShort(s.lastTs))}`)
    console.log(`      ${purple(s.id)}  ${grey(tildify(s.cwd))}`)
  })
  console.log()
}

/** Print a session's conversation; with `search`, only turns that mention it. */
export function viewSession(session: Session, search = ''): void {
  const w = width()
  const q = search.toLowerCase()
  const turns = q
    ? session.turns.filter(t => `${t.prompt}\n${t.reply}`.toLowerCase().includes(q))
    : session.turns

  console.log()
  console.log(`  ${bold(gold(session.title))}`)
  console.log(`  ${purple(session.id)}  ${grey(tildify(session.cwd))}`)
  const shown = q ? `${turns.length} of ${session.turns.length} turns match "${search}"` : `${turns.length} turns`
  console.log(`  ${dim(`${shown} · started ${fmtTime(session.firstTs)}`)}`)

  for (const t of turns) {
    console.log(`\n  ${frame('─'.repeat(w))}`)
    console.log(`  ${blue(bold('▶ You'))}  ${grey(fmtTime(t.promptTs))}\n`)
    console.log(renderBody(t.prompt, search, w))
    if (t.reply) {
      console.log(`\n  ${green(bold('◆ Claude'))}  ${grey(fmtTime(t.replyTs))}\n`)
      console.log(renderBody(t.reply, search, w))
    }
  }
  console.log(`\n  ${dim(`Resume it:  claude-past open ${session.id.slice(0, 8)}`)}\n`)
}
