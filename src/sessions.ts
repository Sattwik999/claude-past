import { readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { Session, RawMessage, ContentBlock } from './types.js'

export function getSessionsDir(): string {
  // Try common Claude Code session locations
  const base = join(homedir(), '.claude', 'projects')
  const dirs = readdirSync(base).map(d => join(base, d))
  // Pick the dir with the most .jsonl files (most likely the active one)
  let best = dirs[0] ?? base
  let max = 0
  for (const d of dirs) {
    try {
      const count = readdirSync(d).filter(f => f.endsWith('.jsonl')).length
      if (count > max) { max = count; best = d }
    } catch { /* skip */ }
  }
  return best
}

export function extractText(content: string | ContentBlock[] | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return content.trim()
  return content
    .filter(b => b.type === 'text' && b.text)
    .map(b => b.text!.trim())
    .join('\n')
}

export function loadSessions(): Session[] {
  const dir = getSessionsDir()
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  return files.map(({ name, path }) => {
    const id = name.replace('.jsonl', '')
    let messages: RawMessage[] = []
    try {
      messages = readFileSync(path, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l) as RawMessage)
    } catch { /* corrupted line */ }

    const userMsgs = messages.filter(
      m => m.type === 'user' && m.origin?.kind === 'human'
    )
    const aiTitle = messages.find(m => m.type === 'ai-title')?.title ?? ''
    const title =
      aiTitle ||
      extractText(userMsgs[0]?.message?.content).slice(0, 70).replace(/\n/g, ' ') ||
      '(no title)'

    return {
      id,
      filePath: path,
      title,
      turns: userMsgs.length,
      firstTs: userMsgs[0]?.timestamp ?? '',
      lastTs: userMsgs.at(-1)?.timestamp ?? '',
      messages,
    }
  })
}

export function getPairs(session: Session) {
  const userMap = new Map(
    session.messages
      .filter(m => m.type === 'user' && m.origin?.kind === 'human' && m.uuid)
      .map(m => [m.uuid!, m])
  )
  const assistants = session.messages.filter(m => m.type === 'assistant')

  return assistants
    .map(ai => ({ user: userMap.get(ai.parentUuid ?? ''), assistant: ai }))
    .filter((p): p is { user: RawMessage; assistant: RawMessage } => !!p.user)
}
