'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from '@phosphor-icons/react'

interface MarkdownRendererProps {
    content: string
    className?: string
}

// Code block with copy button
function CodeBlock({ language, children }: { language: string | undefined, children: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(children)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const displayLanguage = language || 'text'

    return (
        <div className="relative group/codeblock my-4 rounded-xl overflow-hidden border border-border/40 bg-[#1e1e1e]">
            {/* Header with language and copy button */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-border/20">
                <span className="text-xs font-mono text-muted-foreground/80 uppercase tracking-wide">
                    {displayLanguage}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-green-500">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code content */}
            <div className="overflow-x-auto">
                <SyntaxHighlighter
                    language={language || 'text'}
                    style={oneDark}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                    }}
                    showLineNumbers={children.split('\n').length > 5}
                    lineNumberStyle={{
                        minWidth: '2.5rem',
                        paddingRight: '1rem',
                        color: '#666',
                        userSelect: 'none'
                    }}
                >
                    {children}
                </SyntaxHighlighter>
            </div>
        </div>
    )
}

// Inline code (not in a block)
function InlineCode({ children }: { children: React.ReactNode }) {
    return (
        <code className="bg-muted/60 px-1.5 py-0.5 rounded-md text-sm font-mono text-primary border border-border/30">
            {children}
        </code>
    )
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    if (!content || content.trim() === '') {
        return null
    }

    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Code blocks with syntax highlighting
                    code({ className, children, node, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const codeString = String(children).replace(/\n$/, '')

                        // Check if it's a code block (multi-line) vs inline code
                        const isCodeBlock = match || codeString.includes('\n')

                        if (isCodeBlock) {
                            return (
                                <CodeBlock language={match?.[1]}>
                                    {codeString}
                                </CodeBlock>
                            )
                        }

                        return <InlineCode>{children}</InlineCode>
                    },

                    // Pre tag (wraps code blocks)
                    pre({ children }) {
                        return <>{children}</>
                    },

                    // Tables
                    table({ children }) {
                        return (
                            <div className="overflow-x-auto my-4 rounded-lg border border-border/50">
                                <table className="w-full border-collapse text-sm">
                                    {children}
                                </table>
                            </div>
                        )
                    },
                    thead({ children }) {
                        return (
                            <thead className="bg-muted/50 border-b border-border/50">
                                {children}
                            </thead>
                        )
                    },
                    th({ children }) {
                        return (
                            <th className="px-4 py-2.5 text-left font-semibold text-foreground/90">
                                {children}
                            </th>
                        )
                    },
                    td({ children }) {
                        return (
                            <td className="px-4 py-2.5 border-t border-border/30 text-foreground/80">
                                {children}
                            </td>
                        )
                    },

                    // Lists
                    ul({ children }) {
                        return (
                            <ul className="list-disc list-outside ml-5 space-y-1.5 my-3 text-foreground/90">
                                {children}
                            </ul>
                        )
                    },
                    ol({ children }) {
                        return (
                            <ol className="list-decimal list-outside ml-5 space-y-1.5 my-3 text-foreground/90">
                                {children}
                            </ol>
                        )
                    },
                    li({ children }) {
                        return (
                            <li className="leading-relaxed pl-1">
                                {children}
                            </li>
                        )
                    },

                    // Headings
                    h1({ children }) {
                        return <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
                    },
                    h2({ children }) {
                        return <h2 className="text-lg font-bold mt-5 mb-2.5 text-foreground">{children}</h2>
                    },
                    h3({ children }) {
                        return <h3 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h3>
                    },

                    // Blockquotes
                    blockquote({ children }) {
                        return (
                            <blockquote className="border-l-4 border-primary/50 pl-4 my-4 italic text-muted-foreground bg-muted/20 py-2 pr-4 rounded-r-lg">
                                {children}
                            </blockquote>
                        )
                    },

                    // Paragraphs
                    p({ children }) {
                        return (
                            <p className="leading-relaxed my-2 text-foreground/90">
                                {children}
                            </p>
                        )
                    },

                    // Links
                    a({ href, children }) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                            >
                                {children}
                            </a>
                        )
                    },

                    // Horizontal rule
                    hr() {
                        return <hr className="my-6 border-t border-border/50" />
                    },

                    // Strong/Bold
                    strong({ children }) {
                        return <strong className="font-semibold text-foreground">{children}</strong>
                    },

                    // Emphasis/Italic
                    em({ children }) {
                        return <em className="italic text-foreground/90">{children}</em>
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

export default MarkdownRenderer
