import { useCallback, useRef, useState } from "react";

/**
 * FR-017 — Streaming Cancel
 *
 * Usage in AgentSuitePanel (or wherever streaming chat lives):
 *
 *   const { isStreaming, startStream, cancelStream } = useStreamingCancel();
 *
 *   // On send:
 *   await startStream(async (signal) => {
 *     const res = await fetch("/api/agent/chat", {
 *       method: "POST",
 *       signal,                          // <-- AbortController signal
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ messages }),
 *     });
 *     for await (const chunk of readSSE(res)) {
 *       appendToCurrentMessage(chunk.text);
 *     }
 *   });
 *
 *   // Cancel button (only shown when streaming):
 *   {isStreaming && <button onClick={cancelStream}>Stop</button>}
 *
 * Partial response behaviour:
 *   The caller accumulates partial text into the message store before the
 *   AbortError is thrown. `startStream` catches AbortError silently and
 *   returns — the partial content already in the store is preserved.
 *   Any other error is re-thrown so the caller can surface it to the user.
 */

export function useStreamingCancel() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  /**
   * Start a streaming operation.
   * @param fn  Async function that receives an AbortSignal and does the fetch.
   *            It should accumulate partial text into the message store
   *            before any await points so partial content is preserved on cancel.
   */
  const startStream = useCallback(
    async (fn: (signal: AbortSignal) => Promise<void>) => {
      // Cancel any in-flight request before starting a new one
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;
      setIsStreaming(true);

      try {
        await fn(controller.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — partial response already in store. Swallow.
          return;
        }
        throw err; // Real errors propagate to the caller
      } finally {
        controllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [],
  );

  const cancelStream = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { isStreaming, startStream, cancelStream };
}
