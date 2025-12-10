'use client'

import { useEffect, useCallback, useRef } from 'react'

export interface KeyboardShortcutsConfig {
    // Core Actions
    onSendMessage?: () => void
    onOpenCommandPalette?: () => void
    onBranchCurrentNode?: () => void
    onCycleModels?: () => void
    onGlobalSearch?: () => void
    onEscape?: () => void

    // Navigation
    onCanvasView?: () => void
    onChatView?: () => void
    onGoToMain?: () => void

    // Selection
    onSelectAll?: () => void
    onDeselectAll?: () => void

    // New Conversation
    onNewConversation?: () => void

    // Export
    onExport?: () => void

    // Disabled state (e.g., when modal is open or input is focused)
    disabled?: boolean
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
    const configRef = useRef(config)
    configRef.current = config

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const cfg = configRef.current

        // Skip if disabled
        if (cfg.disabled) return

        // Skip if user is typing in an input or textarea (except for Escape)
        const target = e.target as HTMLElement
        const isInputFocused = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable

        const isMod = e.metaKey || e.ctrlKey

        // ===================
        // ESCAPE - Always works
        // ===================
        if (e.key === 'Escape') {
            cfg.onEscape?.()
            return
        }

        // Skip other shortcuts if typing in input (except Cmd+Enter)
        if (isInputFocused) {
            // Cmd/Ctrl + Enter - Send message (works even in textarea)
            if (isMod && e.key === 'Enter') {
                e.preventDefault()
                cfg.onSendMessage?.()
                return
            }
            // Allow typing in inputs for all other keys
            return
        }

        // ===================
        // CORE SHORTCUTS
        // ===================

        // Cmd/Ctrl + K - Command Palette
        if (isMod && e.key === 'k') {
            e.preventDefault()
            cfg.onOpenCommandPalette?.()
            return
        }

        // Cmd/Ctrl + \ - Branch/Fork current node
        if (isMod && e.key === '\\') {
            e.preventDefault()
            cfg.onBranchCurrentNode?.()
            return
        }

        // Tab - Cycle through AI models (when not in input)
        if (e.key === 'Tab' && !e.shiftKey && !isMod) {
            e.preventDefault()
            cfg.onCycleModels?.()
            return
        }

        // Cmd/Ctrl + Shift + F - Global Search
        if (isMod && e.shiftKey && e.key === 'f') {
            e.preventDefault()
            cfg.onGlobalSearch?.()
            return
        }

        // ===================
        // NAVIGATION SHORTCUTS
        // ===================

        // Cmd/Ctrl + 1 - Canvas View
        if (isMod && e.key === '1') {
            e.preventDefault()
            cfg.onCanvasView?.()
            return
        }

        // Cmd/Ctrl + 2 - Chat View
        if (isMod && e.key === '2') {
            e.preventDefault()
            cfg.onChatView?.()
            return
        }

        // Home - Go to Main node
        if (e.key === 'Home') {
            e.preventDefault()
            cfg.onGoToMain?.()
            return
        }

        // ===================
        // SELECTION SHORTCUTS
        // ===================

        // Cmd/Ctrl + A - Select All (when not in input)
        if (isMod && e.key === 'a') {
            e.preventDefault()
            cfg.onSelectAll?.()
            return
        }

        // Cmd/Ctrl + D - Deselect All
        if (isMod && e.key === 'd') {
            e.preventDefault()
            cfg.onDeselectAll?.()
            return
        }

        // ===================
        // UTILITY SHORTCUTS
        // ===================

        // Cmd/Ctrl + N - New Conversation
        if (isMod && e.key === 'n') {
            e.preventDefault()
            cfg.onNewConversation?.()
            return
        }

        // Cmd/Ctrl + E - Export
        if (isMod && e.key === 'e') {
            e.preventDefault()
            cfg.onExport?.()
            return
        }

    }, [])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}

// Helper to display shortcut in UI
export function formatShortcut(key: string, mod = true): string {
    const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? '⌘' : 'Ctrl'

    if (mod) {
        return `${modKey}+${key.toUpperCase()}`
    }
    return key.toUpperCase()
}
