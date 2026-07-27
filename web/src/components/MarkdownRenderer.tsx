import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

interface MarkdownRendererProps {
  content: string
}

function CodeBlock({
  language,
  children,
}: {
  language: string
  children: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [children])

  const lineCount = children.split('\n').length

  return (
    <div className="group relative my-2 rounded-md overflow-hidden border border-line">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1e2e] border-b border-line text-xs text-muted">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-ink"
        >
          {copied ? (
            <>
              <Check size={12} /> copied
            </>
          ) : (
            <>
              <Copy size={12} /> copy
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.82rem',
          background: '#11111b',
        }}
        showLineNumbers={lineCount > 5}
        lineNumberStyle={{ color: '#45475a', minWidth: '2.5em' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        code({ className, children, ...props }: { className?: string; children?: React.ReactNode; [key: string]: unknown }) {
          const match = /language-(\w+)/.exec(className || '')
          const codeString = String(children).replace(/\n$/, '')

          if (match || codeString.includes('\n')) {
            return (
              <CodeBlock language={match?.[1] || ''}>
                {codeString}
              </CodeBlock>
            )
          }

          return (
            <code
              className="px-1.5 py-0.5 rounded bg-accent-soft text-accent-2 text-[0.85em] border border-line"
              {...props}
            >
              {children}
            </code>
          )
        },
        p({ children }: { children?: React.ReactNode }) {
          return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
        },
        ul({ children }: { children?: React.ReactNode }) {
          return (
            <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>
          )
        },
        ol({ children }: { children?: React.ReactNode }) {
          return (
            <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>
          )
        },
        li({ children }: { children?: React.ReactNode }) {
          return <li className="leading-relaxed">{children}</li>
        },
        h1({ children }: { children?: React.ReactNode }) {
          return (
            <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">
              {children}
            </h1>
          )
        },
        h2({ children }: { children?: React.ReactNode }) {
          return (
            <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">
              {children}
            </h2>
          )
        },
        h3({ children }: { children?: React.ReactNode }) {
          return (
            <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          )
        },
        blockquote({ children }: { children?: React.ReactNode }) {
          return (
            <blockquote className="border-l-2 border-accent/40 pl-3 my-2 text-muted italic">
              {children}
            </blockquote>
          )
        },
        a({ href, children }: { href?: string; children?: React.ReactNode }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-2 underline underline-offset-2"
            >
              {children}
            </a>
          )
        },
        table({ children }: { children?: React.ReactNode }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-sm border-collapse border border-line">
                {children}
              </table>
            </div>
          )
        },
        th({ children }: { children?: React.ReactNode }) {
          return (
            <th className="px-3 py-1.5 text-left bg-surface-2 border border-line font-semibold text-xs">
              {children}
            </th>
          )
        },
        td({ children }: { children?: React.ReactNode }) {
          return (
            <td className="px-3 py-1.5 border border-line text-xs">
              {children}
            </td>
          )
        },
        hr() {
          return <hr className="border-line my-4" />
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
