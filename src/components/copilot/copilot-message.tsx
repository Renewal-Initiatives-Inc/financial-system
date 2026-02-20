'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Wrench, User, Bot } from 'lucide-react'
import type { CopilotMessage as CopilotMessageType } from '@/lib/copilot/types'

interface CopilotMessageProps {
  message: CopilotMessageType
}

export function CopilotMessage({ message }: CopilotMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="space-y-2">
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="space-y-1">
                {message.toolCalls.map((tc, i) => (
                  <ToolCallIndicator key={i} name={tc.name} result={tc.result} />
                ))}
              </div>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownContent content={message.content} />
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <div className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}

function ToolCallIndicator({ name, result }: { name: string; result: unknown }) {
  const [expanded, setExpanded] = useState(false)
  const label = toolNameLabels[name] || name

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="bg-background/50 flex w-full items-center gap-1.5 rounded border px-2 py-1 text-left text-xs"
      data-testid={`tool-call-${name}`}
    >
      <Wrench className="text-muted-foreground h-3 w-3 shrink-0" />
      <span className="text-muted-foreground">{label}</span>
      {expanded ? (
        <ChevronDown className="ml-auto h-3 w-3" />
      ) : (
        <ChevronRight className="ml-auto h-3 w-3" />
      )}
      {expanded && (
        <pre className="mt-1 block w-full overflow-x-auto text-[10px]">
          {JSON.stringify(result, null, 2)?.slice(0, 500)}
        </pre>
      )}
    </button>
  )
}

const toolNameLabels: Record<string, string> = {
  taxLawSearch: 'Searched tax law knowledge',
  regulationLookup: 'Looked up regulation',
  nonprofitExplorerLookup: 'Searched nonprofit data',
  searchTransactions: 'Searched transactions',
  searchAccounts: 'Searched accounts',
  getAccountBalance: 'Retrieved account balance',
  getFundBalance: 'Retrieved fund balance',
  searchAuditLog: 'Searched audit log',
}

/** Simple markdown renderer — handles bold, lists, code, links, and tables */
function MarkdownContent({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Table: collect consecutive lines containing |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />)
      continue
    }

    // Code blocks: collect content between ``` fences
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++ // skip opening fence
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      // i now points at closing fence (or end of lines)
      elements.push(
        <pre key={`code-${i}`} className="bg-background/60 overflow-x-auto rounded border px-2.5 py-2 text-[11px] leading-relaxed">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      i++ // skip closing fence
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="font-semibold">{renderInline(line.slice(4))}</h4>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="font-semibold">{renderInline(line.slice(3))}</h3>)
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="font-bold">{renderInline(line.slice(2))}</h2>)
    }
    // Horizontal rule
    else if (line.match(/^[-*_]{3,}\s*$/)) {
      elements.push(<hr key={i} className="border-border my-1" />)
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-primary/40 text-muted-foreground border-l-2 pl-2.5 text-[12px] italic">
          {renderInline(line.slice(2))}
        </blockquote>
      )
    }
    // Bullet lists (with indent support)
    else if (line.match(/^(\s*)[-*]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0
      const level = Math.floor(indent / 2)
      elements.push(
        <div key={i} className="flex gap-1.5" style={level > 0 ? { paddingLeft: `${level * 12}px` } : undefined}>
          <span className="shrink-0">{level > 0 ? '◦' : '•'}</span>
          <span>{renderInline(line.replace(/^\s*[-*]\s/, ''))}</span>
        </div>
      )
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)?.[1]
      elements.push(
        <div key={i} className="flex gap-1.5">
          <span className="shrink-0">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
    }
    // Empty line
    else if (!line.trim()) {
      elements.push(<div key={i} className="h-1" />)
    }
    // Normal paragraph
    else {
      elements.push(<p key={i}>{renderInline(line)}</p>)
    }

    i++
  }

  return <>{elements}</>
}

/** Render a markdown table from consecutive pipe-delimited lines */
function MarkdownTable({ lines }: { lines: string[] }) {
  const parseRow = (line: string): string[] =>
    line.split('|').slice(1, -1).map(cell => cell.trim())

  const isSeparator = (line: string): boolean =>
    /^\|[\s:|-]+\|$/.test(line) && line.replace(/[\s|:-]/g, '').length === 0

  // Detect header row (row before a separator)
  const sepIndex = lines.findIndex(isSeparator)
  let headerCells: string[] | null = null
  let bodyLines: string[]

  if (sepIndex === 1) {
    headerCells = parseRow(lines[0])
    bodyLines = lines.slice(2)
  } else if (sepIndex === 0) {
    bodyLines = lines.slice(1)
  } else {
    bodyLines = lines
  }

  const bodyRows = bodyLines.filter(l => !isSeparator(l)).map(parseRow)

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        {headerCells && (
          <thead>
            <tr className="border-border border-b">
              {headerCells.map((cell, j) => (
                <th key={j} className="text-muted-foreground px-2 py-1.5 text-left text-[11px] font-semibold whitespace-nowrap">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((cells, rowIdx) => (
            <tr key={rowIdx} className={cn(
              'border-border/40 border-b last:border-0',
              rowIdx % 2 === 1 && 'bg-muted/30'
            )}>
              {cells.map((cell, cellIdx) => (
                <td key={cellIdx} className="max-w-[180px] truncate px-2 py-1.5">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Render inline markdown: bold, italic, code, links */
function renderInline(text: string): React.ReactNode {
  // Simple replacement-based approach for inline formatting
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Inline code: `text`
    const codeMatch = remaining.match(/`([^`]+)`/)
    // Link: [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

    // Find the earliest match
    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
      linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index)

    if (matches.length === 0) {
      parts.push(remaining)
      break
    }

    const first = matches[0]!
    const beforeText = remaining.slice(0, first.index)
    if (beforeText) parts.push(beforeText)

    switch (first.type) {
      case 'bold':
        parts.push(<strong key={key++}>{first.match![1]}</strong>)
        remaining = remaining.slice(first.index + first.match![0].length)
        break
      case 'code':
        parts.push(
          <code key={key++} className="bg-background rounded px-1 py-0.5 text-xs">
            {first.match![1]}
          </code>
        )
        remaining = remaining.slice(first.index + first.match![0].length)
        break
      case 'link':
        parts.push(
          <a key={key++} href={first.match![2]} className="text-primary underline" target="_blank" rel="noopener noreferrer">
            {first.match![1]}
          </a>
        )
        remaining = remaining.slice(first.index + first.match![0].length)
        break
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}
