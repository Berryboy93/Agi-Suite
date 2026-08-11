/**
 * VocalSpectraHandler
 *
 * Configures a VocalSpectra DSP node on the Stable platform via AgentBridge.
 * Stub — full implementation follows VocalSpectra PRD v2.0.
 */
import type { AgentHandler, AgentBridge } from "../types.js";

interface VocalSpectraConfig {
  nodeId: string;
  settings?: Record<string, unknown>;
}

export const VocalSpectraHandler: AgentHandler = {
  async execute(
    rawConfig: Record<string, unknown>,
    bridge: AgentBridge,
  ): Promise<void> {
    const cfg = rawConfig as unknown as VocalSpectraConfig;

    if (!cfg.nodeId) {
      throw new Error("[VocalSpectraHandler] nodeId is required");
    }

    await bridge.configureVocalSpectraNode({
      nodeId: cfg.nodeId,
      settings: cfg.settings ?? {},
    });
  },
};
