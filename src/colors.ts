const useColor = process.stdout.isTTY && !process.env.NO_COLOR

const c = (code: string) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s

export const bold   = c('1')
export const dim    = c('2')
export const gold   = c('38;2;255;215;0')
export const blue   = c('38;2;100;160;255')
export const green  = c('38;2;80;220;120')
export const grey   = c('38;2;130;120;160')
export const purple = c('38;2;160;120;240')
export const cyan   = c('38;2;100;220;220')
export const frame  = c('38;2;80;70;120')
export const yellow = c('38;2;255;220;60')
export const selected = c('48;2;42;31;78')

/** Usable text width for the current terminal. */
export function width(): number {
  return Math.max(40, Math.min((process.stdout.columns || 80) - 4, 100))
}

/** Cut or pad plain text to exactly n characters. */
export function fit(s: string, n: number): string {
  if (n <= 0) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n)
}

export function fmtTime(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

/** Compact date for list rows, e.g. "10 Nov, 07:57 am". */
export function fmtShort(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

/** Show the home directory as ~. */
export function tildify(path: string): string {
  const home = process.env.HOME ?? ''
  return home && path.startsWith(home) ? '~' + path.slice(home.length) : path
}
