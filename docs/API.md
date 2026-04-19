# API Reference

Base URL (development): `http://localhost:3001/api`  
Base URL (production): `https://<railway-domain>/api`

All request bodies are JSON. All responses are JSON unless noted as SSE.

---

## Health

### `GET /api/healthz`

Liveness check. Returns immediately with no database or external dependency calls.

**Response `200`**

```json
{ "status": "ok" }
```

---

## Metrics

The metrics system tracks active browser sessions and a running total subscriber count. Sessions expire after 45 seconds without a heartbeat.

### `GET /api/metrics`

Snapshot of current metrics state.

**Response `200`**

```json
{
  "activeUsers": 1,
  "totalSubscribers": 147
}
```

| Field              | Type     | Description                                                                                                                                  |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeUsers`      | `number` | Sessions active within the last 45 seconds                                                                                                   |
| `totalSubscribers` | `number` | Cumulative unique sessions since first run. Persisted across restarts in `/tmp/r3-metrics.json`. Starts at 147 if no persisted value exists. |

---

### `GET /api/metrics/stream`

Server-Sent Events stream. Emits a data event on every session change (new session, session expiry). Sends a keep-alive ping every 20 seconds.

**Response headers**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Event format**

```
data: {"activeUsers":2,"totalSubscribers":148}

: ping
```

The client should reconnect automatically on connection loss. The stream emits the current state immediately on connection before any change events.

---

### `POST /api/metrics/heartbeat`

Registers or refreshes a session. Must be called at least once every 45 seconds to keep the session active. The frontend calls this every 30 seconds.

**Request body**

```json
{ "sessionId": "uuid-v4-string" }
```

| Field       | Required | Description                                                                                   |
| ----------- | -------- | --------------------------------------------------------------------------------------------- |
| `sessionId` | yes      | Stable identifier for this browser session. Generate once on page load and persist in memory. |

**Response `200`**

```json
{
  "ok": true,
  "activeUsers": 2,
  "totalSubscribers": 148
}
```

**Response `400`** — missing or invalid `sessionId`

```json
{ "error": "sessionId required" }
```

**Side effects:** On a new `sessionId`, `totalSubscribers` is incremented and persisted. On every heartbeat (new or known), the current metrics state is broadcast to all active SSE clients.

---

## Agent

The agent endpoint is a server-side proxy to the Anthropic Streaming Messages API. The API key never leaves the server.

### `POST /api/agent/chat`

Initiates a streaming conversation turn with Claude. Returns a Server-Sent Events stream.

**Request body**

```json
{
  "messages": [
    { "role": "user", "content": "What is the LLPTE pipeline?" },
    { "role": "assistant", "content": "The LLPTE pipeline..." },
    { "role": "user", "content": "Tell me more about llpte-signal." }
  ],
  "system": "You are an expert on the R3 v4 codebase.",
  "max_tokens": 1500
}
```

| Field        | Type        | Required | Default | Description                                                                                     |
| ------------ | ----------- | -------- | ------- | ----------------------------------------------------------------------------------------------- |
| `messages`   | `Message[]` | yes      | —       | Full conversation history. Must alternate user/assistant. Final message must be `role: "user"`. |
| `system`     | `string`    | no       | —       | System prompt injected before the conversation.                                                 |
| `max_tokens` | `number`    | no       | `1500`  | Maximum tokens in the response.                                                                 |

**Message object**

```typescript
{
  role: "user" | "assistant";
  content: string;
}
```

**Response headers**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**SSE event: text delta**

```
data: {"type":"text_delta","text":"The LLPTE"}

data: {"type":"text_delta","text":" pipeline consists"}
```

Emitted for each incremental text chunk from the model. Accumulate `text` fields in order to build the full response.

**SSE event: done**

```
data: [DONE]
```

Emitted once when the model finishes. The connection closes immediately after.

**SSE event: error**

```
data: {"type":"error","message":"..."}
```

Emitted on non-abort errors (rate limit, API error, etc.). The connection closes after this event.

**Response `400`** — malformed request (before stream opens)

```json
{ "error": "messages array required" }
```

**Response `503`** — `ANTHROPIC_API_KEY` not configured on server

```json
{ "error": "ANTHROPIC_API_KEY not configured on server" }
```

**Client disconnect:** If the client closes the connection mid-stream (e.g. navigation, component unmount), the server detects the close event, calls `stream.abort()`, and terminates the Anthropic API request. No error is sent — the connection is simply closed.

**Model used:** `claude-sonnet-4-20250514`

---

## Error handling

All routes use Express 5's async error propagation. Unhandled errors fall through to the default Express error handler, which returns a generic 500 response. Route-level errors that occur before the SSE stream is opened return JSON. Errors that occur after the stream is opened are sent as SSE error events.

---

## SDK note: abort vs error events

The Anthropic `MessageStream` distinguishes two error event types:

| Event   | When                                        | How handled                                               |
| ------- | ------------------------------------------- | --------------------------------------------------------- |
| `error` | Real API errors (rate limit, network, etc.) | Written to SSE stream as `{"type":"error"}` event         |
| `abort` | Client disconnect triggers `stream.abort()` | No-op listener — prevents intentional unhandled rejection |

Both must be explicitly handled. The `abort` event is separate from the `error` event and requires its own `.on("abort", () => {})` listener to prevent the SDK from calling `Promise.reject()` and crashing the process.
