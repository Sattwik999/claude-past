/**
 * Full-screen session picker with live search and rename. No dependencies.
 *
 *   type        filter by title, ID, folder or anything said in the session
 *   ↑ ↓         move            Enter   open in Claude Code
 *   Tab         read transcript Ctrl+R  rename
 *   Ctrl+D      delete (moves the session to the trash)
 *   Ctrl+G      switch between this directory and all directories
 *   Esc         clear search, then quit
 */

import type { Session } from './types.js'
import { filterSessions, snippet } from './sessions.js'
import {
  bold, dim, gold, grey, purple, cyan, frame, selected,
  fit, fmtShort, tildify, width,
} from './colors.js'

export type Scope = 'here' | 'all'
export type PickResult = { action: 'open' | 'view'; session: Session } | null

/** Split a raw input chunk into single keys (several can arrive together). */
function splitKeys(chunk: string): string[] {
  return chunk.match(/\x1b\[[0-9;]*[A-Za-z~]|\x1b|[\x00-\x1f\x7f]|[^\x00-\x1f\x7f]+/g) ?? []
}

/** Run `onKey` for every key press until it calls the `stop` it is given. */
function readKeys(onKey: (key: string, stop: () => void) => void, onResize?: () => void): void {
  const { stdin, stdout } = process
  let done = false
  const stop = () => {
    done = true
    stdin.off('data', onData)
    if (onResize) stdout.off('resize', onResize)
    stdin.setRawMode(false)
    stdin.pause()
  }
  const onData = (chunk: string) => {
    for (const key of splitKeys(chunk)) {
      if (done) return
      onKey(key, stop)
    }
  }
  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf-8')
  stdin.on('data', onData)
  if (onResize) stdout.on('resize', onResize)
}

/**
 * Ask which sessions to show: this directory's or all of them.
 * Resolves null if the person quits.
 */
export function chooseScope(hereCount: number, allCount: number, dir: string): Promise<Scope | null> {
  return new Promise(resolve => {
    const { stdout } = process
    let scope: Scope = 'here'
    const options: { scope: Scope; label: string; note: string }[] = [
      { scope: 'here', label: 'This directory', note: `${hereCount} sessions · ${tildify(dir)}` },
      { scope: 'all', label: 'All directories', note: `${allCount} sessions` },
    ]
    const LINES = 6

    const render = (first = false) => {
      const out = ['', `  ${bold(gold('Which sessions do you want to see?'))}`, '']
      for (const o of options) {
        out.push(o.scope === scope
          ? `  ${selected(`${gold('▶')} ${bold(o.label.padEnd(16))}`)} ${grey(o.note)}`
          : `    ${o.label.padEnd(16)} ${dim(o.note)}`)
      }
      out.push(`  ${dim('↑↓ choose · Enter confirm · Esc quit')}`)
      stdout.write((first ? '' : `\x1b[${LINES}A`) + out.map(l => `\x1b[2K${l}`).join('\n') + '\n')
    }

    stdout.write('\x1b[?25l')
    render(true)
    readKeys((key, stop) => {
      const end = (result: Scope | null) => {
        stop()
        stdout.write(`\x1b[${LINES}A\x1b[J\x1b[?25h`)   // erase the question
        resolve(result)
      }
      if (key === '\r' || key === '\n') return end(scope)
      if (key === '\x1b' || key === '\x03' || key === 'q') return end(null)
      if (['\x1b[A', '\x1b[B', '\t', 'j', 'k'].includes(key)) scope = scope === 'here' ? 'all' : 'here'
      else if (key === 'd' || key === 't' || key === '1') scope = 'here'
      else if (key === 'a' || key === 'g' || key === '2') scope = 'all'
      render()
    })
  })
}

export interface PickOptions {
  all: Session[]
  here: Session[]
  dir: string
  scope: Scope
  query: string
  onRename: (session: Session, name: string) => void
  /** Delete the session; return an error message to show, or nothing on success. */
  onDelete: (session: Session) => string | void
}

export function pick(opts: PickOptions): Promise<PickResult> {
  return new Promise(resolve => {
    const { stdout } = process
    let scope = opts.scope
    let query = opts.query
    let idx = 0
    let top = 0
    let renaming = false
    let renameBuf = ''
    let confirming = false       // waiting for y/n on a delete
    let notice = ''              // one-line message under the list

    const base = () => (scope === 'here' ? opts.here : opts.all)
    let filtered = filterSessions(base(), query)

    const refilter = () => {
      filtered = filterSessions(base(), query)
      idx = 0
      top = 0
    }

    const render = () => {
      const w = width()
      const rows = stdout.rows || 24
      const visible = Math.max(1, Math.floor((rows - 7) / 2))
      if (idx < top) top = idx
      if (idx >= top + visible) top = idx - visible + 1

      const where = scope === 'here' ? `This directory (${tildify(opts.dir)})` : 'All directories'
      const out: string[] = ['']
      out.push(`  ${bold(gold('Claude Code sessions'))}  ${cyan(where)}  ${grey(`${filtered.length} of ${base().length}`)}`)
      out.push(renaming
        ? `  ${cyan('Rename ›')} ${renameBuf}▏`
        : `  ${frame('Search ›')} ${query}▏`)
      out.push(`  ${frame('─'.repeat(w))}`)

      if (!filtered.length) {
        out.push(`  ${grey(base().length ? 'No sessions match.' : 'No sessions were started in this directory. Press Ctrl+G to see all.')}`)
      }

      const titleW = w - 32
      for (let i = top; i < Math.min(top + visible, filtered.length); i++) {
        const s = filtered[i]
        const active = i === idx
        const meta = `${`${s.turns.length} turns`.padStart(9)}  ${fmtShort(s.lastTs).padEnd(16)}`
        const excerpt = snippet(s, query, w - 8)
        const second = excerpt || `${s.id}  ${tildify(s.cwd)}`
        if (active) {
          out.push(`  ${selected(`${gold('▶')} ${bold(fit(s.title, titleW))} ${meta} `)}`)
          out.push(`    ${excerpt ? cyan(fit(second, w - 4)) : purple(fit(second, w - 4))}`)
        } else {
          out.push(`    ${fit(s.title, titleW)} ${grey(meta)}`)
          out.push(`    ${dim(fit(second, w - 4))}`)
        }
      }

      out.push(notice ? `  ${cyan(fit(notice, w))}` : '')
      if (confirming && filtered[idx]) {
        out.push(`  ${gold(bold('Delete'))} ${bold(fit(filtered[idx].title, w - 40).trimEnd())}${gold(bold('?'))}  ${dim('y = move to trash · any other key = cancel')}`)
      } else if (renaming) {
        out.push(`  ${dim('Enter save · Esc cancel · save empty to restore the original title')}`)
      } else {
        out.push(`  ${dim(`↑↓ · Enter open · Tab read · ^R rename · ^D delete · ^G ${scope === 'here' ? 'all dirs' : 'this dir'} · Esc quit`)}`)
      }

      stdout.write('\x1b[H\x1b[2J' + out.join('\n'))
    }

    stdout.write('\x1b[?1049h\x1b[?25l')     // alternate screen, hide cursor
    render()

    readKeys((key, stop) => {
      const finish = (result: PickResult) => {
        stop()
        stdout.write('\x1b[?25h\x1b[?1049l')   // show cursor, leave alternate screen
        resolve(result)
      }
      const current = filtered[idx]

      if (key === '\x03') return finish(null)                    // Ctrl+C
      notice = ''

      if (confirming) {
        confirming = false
        if ((key === 'y' || key === 'Y') && current) {
          const problem = opts.onDelete(current)
          if (problem) {
            notice = problem
          } else {
            for (const list of [opts.all, opts.here]) {
              const at = list.indexOf(current)
              if (at !== -1) list.splice(at, 1)
            }
            filtered = filterSessions(base(), query)
            idx = Math.min(idx, Math.max(0, filtered.length - 1))
            notice = `Moved to trash. Undo: claude-past restore ${current.id.slice(0, 8)}`
          }
        }
        return render()
      }

      if (renaming) {
        if (key === '\r' || key === '\n') {
          opts.onRename(current, renameBuf)
          renaming = false
          const keepId = current.id
          filtered = filterSessions(base(), query)
          idx = Math.max(0, filtered.findIndex(s => s.id === keepId))
        } else if (key === '\x1b') {
          renaming = false
        } else if (key === '\x7f' || key === '\b') {
          renameBuf = renameBuf.slice(0, -1)
        } else if (key === '\x15') {                             // Ctrl+U
          renameBuf = ''
        } else if (!key.startsWith('\x1b') && key >= ' ') {
          renameBuf += key
        }
        return render()
      }

      if (key === '\x1b[A' || key === '\x10') {                  // ↑ / Ctrl+P
        if (idx > 0) idx--
      } else if (key === '\x1b[B' || key === '\x0e') {           // ↓ / Ctrl+N
        if (idx < filtered.length - 1) idx++
      } else if (key === '\r' || key === '\n') {
        if (current) return finish({ action: 'open', session: current })
      } else if (key === '\t') {
        if (current) return finish({ action: 'view', session: current })
      } else if (key === '\x12') {                               // Ctrl+R
        if (current) {
          renaming = true
          renameBuf = current.title
        }
      } else if (key === '\x04') {                               // Ctrl+D
        if (current) confirming = true
      } else if (key === '\x07') {                               // Ctrl+G
        scope = scope === 'here' ? 'all' : 'here'
        refilter()
      } else if (key === '\x1b') {
        if (query) { query = ''; refilter() } else return finish(null)
      } else if (key === '\x7f' || key === '\b') {
        query = query.slice(0, -1); refilter()
      } else if (key === '\x15') {
        query = ''; refilter()
      } else if (!key.startsWith('\x1b') && key >= ' ') {
        query += key; refilter()
      }
      render()
    }, render)
  })
}
