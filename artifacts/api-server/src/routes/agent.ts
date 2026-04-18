import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post("/agent/chat", async (req: Request, res: Response) => {
  const { messages, system, max_tokens = 1500 } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    system?: string;
    max_tokens?: number;
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY not configured on server" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens,
      ...(system ? { system } : {}),
      messages,
    });

    stream.on("text", (text) => {
      res.write(`data: ${JSON.stringify({ type: "text_delta", text })}\n\n`);
    });

    stream.once("finalMessage", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("error", (err: Error) => {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
      res.end();
    });

    req.on("close", () => {
      stream.abort();
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  }
});

export default router;
