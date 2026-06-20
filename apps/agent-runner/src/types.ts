export interface AgentBridge {
  config: { agentId: string; sessionId: string | null; projectId: string | null };
  configureVocalSpectraNode(params: { nodeId: string; settings: Record<string, unknown> }): Promise<void>;
  reportTroubleshooting(findings: Array<{ severity: string; category: string; message: string; fix?: string; autoApply?: boolean }>): Promise<void>;
  pushDSPParam(nodeId: string, param: string, value: number): void;
}

export interface AgentHandler {
  execute(config: Record<string, unknown>, bridge: AgentBridge): Promise<void>;
}
