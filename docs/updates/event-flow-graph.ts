/**
 * ASI WIRE v4 — Event Flow Graph Builder
 *
 * Spec INVARIANT 2: "Every emit() must have a registered handler OR a declared
 *                    intentional no-op policy"
 *
 * Tracks:
 *   emit("event") → handler registration → mutation target
 *
 * Detects:
 *   - missing handlers (orphan emits)
 *   - duplicate handlers
 *   - silent event drops
 */

import type {
  FileSymbols,
  EmitCall,
  HandlerRegistration,
} from "../analysis/ast-types.js";

export interface EventFlowNode {
  readonly eventName: string;
  readonly emits: readonly EmitCall[];
  readonly handlers: readonly HandlerRegistration[];
}

export interface OrphanEvent {
  readonly type: "MISSING_HANDLER";
  readonly eventName: string;
  readonly emits: readonly EmitCall[];
}

export interface DuplicateHandlerViolation {
  readonly type: "DUPLICATE_HANDLER";
  readonly eventName: string;
  readonly handlers: readonly HandlerRegistration[];
}

export interface SilentDropViolation {
  readonly type: "SILENT_EVENT_DROP";
  readonly eventName: string;
  readonly emits: readonly EmitCall[];
  readonly reason: string;
}

export type EventFlowViolation =
  OrphanEvent | DuplicateHandlerViolation | SilentDropViolation;

export interface EventFlowGraph {
  readonly nodes: ReadonlyMap<string, EventFlowNode>;
  readonly dynamicEmits: readonly EmitCall[];
  readonly dynamicHandlers: readonly HandlerRegistration[];
  readonly violations: readonly EventFlowViolation[];
}

/**
 * Build the event flow graph from all parsed file symbols.
 * Dynamic (non-static) emits and handlers are tracked separately
 * as they cannot be statically resolved without runtime information.
 */
export function buildEventFlowGraph(
  files: readonly FileSymbols[],
): EventFlowGraph {
  const emitsByEvent = new Map<string, EmitCall[]>();
  const handlersByEvent = new Map<string, HandlerRegistration[]>();
  const dynamicEmits: EmitCall[] = [];
  const dynamicHandlers: HandlerRegistration[] = [];

  // Collect all emits and handlers across all files
  for (const file of files) {
    for (const emit of file.emits) {
      if (emit.isDynamic || emit.eventName === null) {
        dynamicEmits.push(emit);
      } else {
        if (!emitsByEvent.has(emit.eventName)) {
          emitsByEvent.set(emit.eventName, []);
        }
        emitsByEvent.get(emit.eventName)!.push(emit);
      }
    }

    for (const handler of file.handlers) {
      if (handler.isDynamic || handler.eventName === null) {
        dynamicHandlers.push(handler);
      } else {
        if (!handlersByEvent.has(handler.eventName)) {
          handlersByEvent.set(handler.eventName, []);
        }
        handlersByEvent.get(handler.eventName)!.push(handler);
      }
    }
  }

  // Build flow nodes for all known event names
  const allEventNames = new Set([
    ...emitsByEvent.keys(),
    ...handlersByEvent.keys(),
  ]);

  const nodes = new Map<string, EventFlowNode>();
  for (const name of allEventNames) {
    nodes.set(name, {
      eventName: name,
      emits: Object.freeze(emitsByEvent.get(name) ?? []),
      handlers: Object.freeze(handlersByEvent.get(name) ?? []),
    });
  }

  // Detect violations
  const violations: EventFlowViolation[] = [];

  for (const [eventName, node] of nodes) {
    // INVARIANT 2: emits with no handler = orphan event
    if (node.emits.length > 0 && node.handlers.length === 0) {
      violations.push({
        type: "MISSING_HANDLER",
        eventName,
        emits: node.emits,
      });
    }

    // Duplicate handlers: >1 handler for same event name
    if (node.handlers.length > 1) {
      violations.push({
        type: "DUPLICATE_HANDLER",
        eventName,
        handlers: node.handlers,
      });
    }

    // Silent drop: handler exists but no emitter anywhere —
    // handler is dead code (informational, low confidence)
    if (node.handlers.length > 0 && node.emits.length === 0) {
      violations.push({
        type: "SILENT_EVENT_DROP",
        eventName,
        emits: [],
        reason:
          "Handler registered but no static emit found — may be emitted dynamically or is dead code",
      });
    }
  }

  return Object.freeze({
    nodes: Object.freeze(nodes),
    dynamicEmits: Object.freeze(dynamicEmits),
    dynamicHandlers: Object.freeze(dynamicHandlers),
    violations: Object.freeze(violations),
  });
}

export function serializeEventFlowGraph(graph: EventFlowGraph): object {
  return {
    eventCount: graph.nodes.size,
    dynamicEmitCount: graph.dynamicEmits.length,
    dynamicHandlerCount: graph.dynamicHandlers.length,
    violationCount: graph.violations.length,
    events: Object.fromEntries(
      [...graph.nodes.entries()].map(([name, node]) => [
        name,
        {
          emitCount: node.emits.length,
          handlerCount: node.handlers.length,
          emitLocations: node.emits.map((e) => `${e.file}:${e.line}`),
          handlerLocations: node.handlers.map((h) => `${h.file}:${h.line}`),
        },
      ]),
    ),
    violations: graph.violations,
  };
}
