export interface ContentBlock {
  type: string
  text?: string
  name?: string
}

/** One line of a Claude Code session .jsonl file (only the fields we use). */
export interface RawEntry {
  type: string
  timestamp?: string
  cwd?: string
  isSidechain?: boolean
  aiTitle?: string
  origin?: { kind?: string }
  message?: {
    role?: string
    content?: string | ContentBlock[]
  }
}

/** One prompt from the user and everything Claude said in reply. */
export interface Turn {
  prompt: string
  promptTs: string
  reply: string
  replyTs: string
}

export interface Session {
  id: string
  filePath: string
  /** Name of the folder under ~/.claude/projects that holds the file. */
  project: string
  /** Folder the session was started in; `claude --resume` must run there. */
  cwd: string
  /** Name to show: custom name, else Claude's own title, else first prompt. */
  title: string
  customName: string
  turns: Turn[]
  firstTs: string
  lastTs: string
  /** Lower-cased title + id + folder + full conversation, for searching. */
  haystack: string
}
