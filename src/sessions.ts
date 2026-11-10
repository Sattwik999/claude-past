import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync,
  rmSync, statSync, unlinkSync, writeFileSync,
} from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { ContentBlock, RawEntry, Session, Turn } from './types.js'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
  'claude-past'
)
const NAMES_FILE = join(CONFIG_DIR, 'names.json')
const TRASH_DIR = join(CONFIG_DIR, 'trash')

// ── custom names ────────────────────────────────────────────────────────────
// Stored in our own file, so Claude Code's session files are never modified.

export function loadNames(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(NAMES_FILE, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

/** Save a custom name for a session; an empty name removes it. */
export function saveName(id: string, name: string): void {
  const names = loadNames()
  const trimmed = name.trim()
  if (trimmed) names[id] = trimmed
  else delete names[id]
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(NAMES_FILE, JSON.stringify(names, null, 2) + '\n')
}

// ── text helpers ────────────────────────────────────────────────────────────

/** Strip Claude Code's internal markup so only what a person typed/read remains. */
export function cleanText(raw: string): string {
  return raw
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-args>([\s\S]*?)<\/command-args>/g, ' $1')
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, '$1')
    .replace(/<\/?pasted_content[^>]*>/g, '')
    .replace(/\[Image: source: [^\]]*\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function textOf(content: string | ContentBlock[] | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return cleanText(content)
  return cleanText(
    content
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text as string)
      .join('\n')
  )
}

// ── loading ─────────────────────────────────────────────────────────────────

function parseSession(filePath: string, project: string, id: string, names: Record<string, string>): Session | null {
  let entries: RawEntry[]
  try {
    entries = readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        try { return [JSON.parse(line) as RawEntry] } catch { return [] }
      })
  } catch {
    return null
  }

  const turns: Turn[] = []
  let aiTitle = ''
  let cwd = ''

  for (const e of entries) {
    if (e.type === 'ai-title' && e.aiTitle) aiTitle = e.aiTitle   // keep the latest
    if (!cwd && e.cwd) cwd = e.cwd
    if (e.isSidechain) continue                                    // subagent chatter

    if (e.type === 'user' && e.origin?.kind === 'human') {
      const prompt = textOf(e.message?.content)
      if (prompt) turns.push({ prompt, promptTs: e.timestamp ?? '', reply: '', replyTs: '' })
    } else if (e.type === 'assistant' && turns.length) {
      const text = textOf(e.message?.content)
      if (!text) continue
      const turn = turns[turns.length - 1]
      turn.reply = turn.reply ? `${turn.reply}\n\n${text}` : text
      turn.replyTs = e.timestamp ?? turn.replyTs
    }
  }

  if (!turns.length) return null   // nothing a person would recognise

  const customName = names[id] ?? ''
  const firstPrompt = turns[0].prompt.replace(/\s+/g, ' ').slice(0, 80)
  const title = customName || aiTitle || firstPrompt

  let lastTs = turns[turns.length - 1].replyTs || turns[turns.length - 1].promptTs
  if (!lastTs) lastTs = new Date(statSync(filePath).mtimeMs).toISOString()

  const haystack = [
    title, aiTitle, id, cwd,
    ...turns.map(t => `${t.prompt}\n${t.reply}`),
  ].join('\n').toLowerCase()

  return {
    id, filePath, project, cwd, title, customName, turns,
    firstTs: turns[0].promptTs, lastTs, haystack,
  }
}

/** Every session under `root` (one sub-folder per project), newest first. */
function loadFrom(root: string): Session[] {
  if (!existsSync(root)) return []
  const names = loadNames()
  const sessions: Session[] = []

  for (const project of readdirSync(root)) {
    const dir = join(root, project)
    let files: string[]
    try {
      files = readdirSync(dir).filter(f => f.endsWith('.jsonl'))
    } catch {
      continue   // not a directory
    }
    for (const f of files) {
      const s = parseSession(join(dir, f), project, f.slice(0, -'.jsonl'.length), names)
      if (s) sessions.push(s)
    }
  }

  return sessions.sort((a, b) => b.lastTs.localeCompare(a.lastTs))
}

/** Every session from every project folder, newest first. */
export function loadSessions(): Session[] {
  return loadFrom(PROJECTS_DIR)
}

// ── deleting ────────────────────────────────────────────────────────────────
// "Delete" moves the session file into our own trash folder, so it can be
// restored. Only `emptyTrash` removes anything for good.

function move(from: string, to: string): void {
  try {
    renameSync(from, to)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
    copyFileSync(from, to)       // different disk: copy, then remove
    unlinkSync(from)
  }
}

/** True if the session file changed in the last two minutes (probably open now). */
export function looksActive(session: Session): boolean {
  try {
    return Date.now() - statSync(session.filePath).mtimeMs < 2 * 60 * 1000
  } catch {
    return false
  }
}

/** Move a session to the trash. Claude Code will no longer list it. */
export function deleteSession(session: Session): void {
  const dir = join(TRASH_DIR, session.project)
  mkdirSync(dir, { recursive: true })
  move(session.filePath, join(dir, `${session.id}.jsonl`))
}

/** Sessions currently in the trash, newest first. */
export function loadTrash(): Session[] {
  return loadFrom(TRASH_DIR)
}

/** Put a trashed session back where Claude Code can find it. */
export function restoreSession(trashed: Session): void {
  const dir = join(PROJECTS_DIR, trashed.project)
  const target = join(dir, `${trashed.id}.jsonl`)
  if (existsSync(target)) throw new Error('A session with this ID already exists.')
  mkdirSync(dir, { recursive: true })
  move(trashed.filePath, target)
}

/** Permanently remove everything in the trash. */
export function emptyTrash(): void {
  rmSync(TRASH_DIR, { recursive: true, force: true })
}

// ── searching ───────────────────────────────────────────────────────────────

/** Sessions whose title, id, folder or conversation contain every word of the query. */
export function filterSessions(sessions: Session[], query: string): Session[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return sessions
  return sessions.filter(s => words.every(w => s.haystack.includes(w)))
}

/** A short excerpt of the conversation around the first query word, or ''. */
export function snippet(session: Session, query: string, width: number): string {
  const word = query.toLowerCase().split(/\s+/).filter(Boolean)[0]
  if (!word || session.title.toLowerCase().includes(word)) return ''
  for (const t of session.turns) {
    for (const text of [t.prompt, t.reply]) {
      const at = text.toLowerCase().indexOf(word)
      if (at === -1) continue
      const start = Math.max(0, at - Math.floor(width / 3))
      const cut = text.slice(start, start + width).replace(/\s+/g, ' ')
      return (start > 0 ? '…' : '') + cut + (start + width < text.length ? '…' : '')
    }
  }
  return ''
}

/** Find a session by list number (1-based) or by full/partial id. */
export function resolveSession(sessions: Session[], target: string): Session | string {
  // A plain number within the list is a list position; anything else
  // (including digits with a leading zero) is the start of a session ID.
  const n = /^[1-9]\d*$/.test(target) ? parseInt(target, 10) : 0
  if (n >= 1 && n <= sessions.length) return sessions[n - 1]
  const matches = sessions.filter(s => s.id.startsWith(target))
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) return `'${target}' matches ${matches.length} sessions; type more of the ID.`
  return n
    ? `No session #${target} (there are ${sessions.length}).`
    : `No session with ID starting '${target}'.`
}
