import { useCallback, useEffect, useRef } from "react";
import { useAGI } from "../store/useAGI";

/** FR-015 — Conversation persistence (localStorage, Phase 1) */

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number; // Unix ms
}

const STORAGE_KEY = "agi_conversation_history";
const MAX_MESSAGES = 50;

function readStorage(): ConversationMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ConversationMessage[];
  } catch {
    return [];
  }
}

function writeStorage(messages: ConversationMessage[]): void {
  try {
    // Cap at MAX_MESSAGES — truncate from the front (oldest removed)
    const capped =
      messages.length > MAX_MESSAGES
        ? messages.slice(messages.length - MAX_MESSAGES)
        : messages;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // localStorage quota exceeded — silently continue
  }
}

/**
 * useConversation — localStorage-backed conversation history.
 *
 * Returns:
 *   messages      — full conversation array (restored on mount)
 *   addMessage    — append a message and persist
 *   clearHistory  — empty localStorage + Zustand store
 */
export function useConversation() {
  const {
    messages: storeMessages,
    setMessages,
    clearMessages,
  } = useAGI((s) => ({
    messages: s.messages,
    setMessages: s.setMessages,
    clearMessages: s.clearMessages,
  }));

  // Restore from localStorage on first mount only
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = readStorage();
    if (saved.length > 0) {
      setMessages(saved);
    }
  }, [setMessages]);

  // Mirror Zustand state into localStorage on every change (after hydration)
  useEffect(() => {
    if (!hydrated.current) return;
    writeStorage(storeMessages as ConversationMessage[]);
  }, [storeMessages]);

  const addMessage = useCallback(
    (msg: ConversationMessage) => {
      setMessages([...(storeMessages as ConversationMessage[]), msg]);
    },
    [storeMessages, setMessages],
  );

  const clearHistory = useCallback(() => {
    clearMessages();
    localStorage.removeItem(STORAGE_KEY);
  }, [clearMessages]);

  return {
    messages: storeMessages as ConversationMessage[],
    addMessage,
    clearHistory,
  };
}
