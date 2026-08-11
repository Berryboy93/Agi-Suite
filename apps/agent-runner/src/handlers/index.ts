import type { AgentHandler } from "../types.js";
import { VocalSpectraHandler } from "./vocal-spectra.js";

const REGISTRY: Record<string, AgentHandler> = {
  "vocal-spectra": VocalSpectraHandler,
  // 'troubleshoot': TroubleshootHandler,  // TODO
  // 'mix':          MixHandler,           // TODO
  // 'style-delta':  StyleDeltaHandler,    // TODO
};

export function resolveAgentHandler(type: string): AgentHandler {
  const h = REGISTRY[type];
  if (!h) throw new Error(`No handler for agent type: "${type}"`);
  return h;
}

export function registerHandler(type: string, handler: AgentHandler): void {
  if (REGISTRY[type])
    console.warn(`[HandlerRegistry] Overwriting handler: ${type}`);
  REGISTRY[type] = handler;
}

export { VocalSpectraHandler };
export type { AgentHandler };
