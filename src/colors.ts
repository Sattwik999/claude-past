const isTTY = process.stdout.isTTY

const c = (code: string) => (s: string) =>
  isTTY ? `\x1b[${code}m${s}\x1b[0m` : s

export const reset  = '\x1b[0m'
export const bold   = c('1')
export const dim    = c('2')
export const gold   = c('38;2;255;215;0')
export const blue   = c('38;2;100;160;255')
export const green  = c('38;2;80;220;120')
export const pink   = c('38;2;255;120;180')
export const grey   = c('38;2;130;120;160')
export const purple = c('38;2;160;120;240')
export const cyan   = c('38;2;100;220;220')
export const frame  = c('38;2;80;70;120')
export const yellow = c('38;2;255;220;60')

export const W = 72

export function header(text: string): string {
  const bar = frame('─'.repeat(W))
  return [
    `  ${frame('┌')}${bar}${frame('┐')}`,
    `  ${frame('│')} ${bold(gold(text.padEnd(W - 2)))} ${frame('│')}`,
    `  ${frame('└')}${bar}${frame('┘')}`,
  ].join('\n')
}

export function divider(char = '─'): string {
  return `  ${frame(char.repeat(W))}`
}

export function fmtTime(ts: string): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch {
    return ts
  }
}
