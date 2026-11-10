/**
 * Zero-dependency interactive arrow-key picker using raw terminal mode.
 * Falls back to numbered prompt if TTY is unavailable.
 */

import * as readline from 'readline'
import { gold, grey, bold, reset, frame } from './colors.js'

export interface PickerItem {
  label: string
  sub?: string
}

export async function pick(
  items: PickerItem[],
  prompt = 'Select session'
): Promise<number | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return promptNumber(items.length)
  }

  return new Promise(resolve => {
    let idx = 0
    const H = Math.min(items.length, 12)
    let offset = 0  // scroll offset

    const render = () => {
      // move cursor up H*2 + 1 lines after first draw
      process.stdout.write('\x1b[?25l')  // hide cursor
      const lines: string[] = []

      for (let i = offset; i < offset + H && i < items.length; i++) {
        const active = i === idx
        const num    = `${(i + 1).toString().padStart(2)}.`
        const label  = items[i].label
        const sub    = items[i].sub ?? ''
        if (active) {
          lines.push(`  \x1b[48;2;42;31;78m ${gold(bold('▶'))} ${bold(label)} \x1b[0m`)
          if (sub) lines.push(`      ${grey(sub)}`)
        } else {
          lines.push(`     ${grey(num)} ${label}`)
          if (sub) lines.push(`      ${grey(sub)}`)
        }
      }

      const scroll = items.length > H
        ? grey(` (${idx + 1}/${items.length}) ↑↓ navigate  Enter select  q quit`)
        : grey(' ↑↓ navigate  Enter select  q quit')

      lines.push(`\n  ${prompt}${scroll}`)
      process.stdout.write('\x1b[2K' + lines.join('\n'))
    }

    // initial draw — leave room
    process.stdout.write('\n'.repeat(H * 2 + 4))
    process.stdout.write(`\x1b[${H * 2 + 4}A`)
    render()

    const cleanup = () => {
      process.stdout.write('\x1b[?25h')  // show cursor
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf-8')

    process.stdin.on('data', (key: string) => {
      if (key === '\x1b[A' || key === 'k') {       // up
        if (idx > 0) {
          idx--
          if (idx < offset) offset = idx
        }
      } else if (key === '\x1b[B' || key === 'j') { // down
        if (idx < items.length - 1) {
          idx++
          if (idx >= offset + H) offset = idx - H + 1
        }
      } else if (key === '\r' || key === '\n') {    // enter
        cleanup()
        process.stdout.write('\n')
        resolve(idx)
        return
      } else if (key === 'q' || key === '\x03') {   // q or Ctrl+C
        cleanup()
        process.stdout.write('\n')
        resolve(null)
        return
      }
      process.stdout.write(`\x1b[${H * 2 + 4}A\x1b[J`)
      render()
    })
  })
}

async function promptNumber(max: number): Promise<number | null> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`\n  Enter session number (1-${max}): `, ans => {
      rl.close()
      const n = parseInt(ans.trim(), 10)
      resolve(n >= 1 && n <= max ? n - 1 : null)
    })
  })
}
