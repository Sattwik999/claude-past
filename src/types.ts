export interface RawMessage {
  type: string
  uuid?: string
  parentUuid?: string
  timestamp?: string
  message?: {
    role: string
    content: string | ContentBlock[]
    model?: string
    id?: string
  }
  origin?: { kind: string }
  title?: string
  sessionId?: string
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | string
  text?: string
  name?: string
  input?: unknown
}

export interface Session {
  id: string
  filePath: string
  title: string
  turns: number
  firstTs: string
  lastTs: string
  messages: RawMessage[]
}

export interface ConversationPair {
  user: RawMessage
  assistant: RawMessage
}
