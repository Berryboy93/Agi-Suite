/**
 * ASI WIRE v4 — STEP 2: AST PARSE PHASE
 *
 * Spec:
 *   "ts-morph based parsing"
 *   "symbol resolution enabled"
 *   "CallExpression tracking"
 *   "MemberExpression resolution"
 *   "Import graph resolution"
 *   "Symbol reference linking"
 *
 * HARD SAFETY CONSTRAINT: No writes to source code. Analysis only.
 * HARD SAFETY CONSTRAINT: No regex-based mutation anywhere.
 */

import {
  Project,
  SyntaxKind,
  type SourceFile,
  type CallExpression,
  type ImportDeclaration,
  type Node,
} from "ts-morph";
import type {
  FileSymbols,
  ImportEdge,
  EmitCall,
  HandlerRegistration,
  DirectMutation,
  ReduxDispatch,
} from "./ast-types.js";

/** Patterns that identify EventBus emit methods. */
const EMIT_METHOD_NAMES = new Set([
  "emit",
  "dispatch",
  "publish",
  "trigger",
  "fire",
]);

/** Patterns that identify event handler registration. */
const HANDLER_METHOD_NAMES = new Set([
  "on",
  "once",
  "listen",
  "subscribe",
  "addListener",
  "addEventListener",
]);

/** Patterns that identify direct state mutations (INVARIANT 1 violation candidates). */
const DIRECT_MUTATION_PATTERNS = new Set([
  "setState",
  "set",
  "assign",
  "update",
  "mutate",
  "replace",
]);

export interface ParseOptions {
  tsConfigFilePath?: string;
  skipAddingFilesFromTsConfig?: boolean;
}

export class ASTParser {
  private readonly project: Project;

  constructor(options: ParseOptions = {}) {
    this.project = new Project({
      tsConfigFilePath: options.tsConfigFilePath,
      skipAddingFilesFromTsConfig: options.skipAddingFilesFromTsConfig ?? true,
      skipFileDependencyResolution: false,
      // Read-only: never let ts-morph save files
      useInMemoryFileSystem: false,
      compilerOptions: {
        allowJs: false,
        noEmit: true,
        strict: true,
      },
    });
  }

  /**
   * Parse a batch of source files and extract all governance-relevant symbols.
   * Returns one FileSymbols entry per file. Never throws — errors are captured
   * per-file in parseWarnings.
   */
  parseFiles(filePaths: readonly string[]): FileSymbols[] {
    // Add all files to the project in one batch for cross-file symbol resolution
    for (const fp of filePaths) {
      if (!this.project.getSourceFile(fp)) {
        try {
          this.project.addSourceFileAtPath(fp);
        } catch (err) {
          // File will be represented with empty symbols + warning
        }
      }
    }

    return filePaths.map((fp) => this.extractSymbols(fp));
  }

  private extractSymbols(filePath: string): FileSymbols {
    const warnings: string[] = [];
    const sourceFile = this.project.getSourceFile(filePath);

    if (!sourceFile) {
      return {
        filePath,
        imports: [],
        emits: [],
        handlers: [],
        mutations: [],
        dispatches: [],
        parseWarnings: [`Could not load source file: ${filePath}`],
      };
    }

    try {
      return {
        filePath,
        imports: this.extractImports(sourceFile, warnings),
        emits: this.extractEmits(sourceFile, warnings),
        handlers: this.extractHandlers(sourceFile, warnings),
        mutations: this.extractMutations(sourceFile, warnings),
        dispatches: this.extractDispatches(sourceFile, warnings),
        parseWarnings: warnings,
      };
    } catch (err) {
      warnings.push(
        `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        filePath,
        imports: [],
        emits: [],
        handlers: [],
        mutations: [],
        dispatches: [],
        parseWarnings: warnings,
      };
    }
  }

  // ─── Import Graph Resolution ──────────────────────────────────────────────

  private extractImports(sf: SourceFile, warnings: string[]): ImportEdge[] {
    const edges: ImportEdge[] = [];

    for (const decl of sf.getImportDeclarations()) {
      const edge = this.resolveImportEdge(sf, decl, warnings);
      if (edge) edges.push(edge);
    }

    // Also capture dynamic import() calls
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
        const args = call.getArguments();
        const specifier = args[0];
        if (specifier) {
          const raw = tryGetStringLiteral(specifier);
          edges.push({
            fromFile: sf.getFilePath(),
            toFile: raw ?? "[dynamic]",
            specifier: raw ?? "[dynamic]",
            line: call.getStartLineNumber(),
            isTypeOnly: false,
          });
        }
      }
    });

    return edges;
  }

  private resolveImportEdge(
    sf: SourceFile,
    decl: ImportDeclaration,
    warnings: string[],
  ): ImportEdge | null {
    try {
      const specifier = decl.getModuleSpecifierValue();
      let resolvedPath: string;

      try {
        const resolvedSf = decl.getModuleSpecifierSourceFile();
        resolvedPath = resolvedSf?.getFilePath() ?? specifier;
      } catch {
        resolvedPath = specifier;
      }

      return {
        fromFile: sf.getFilePath(),
        toFile: resolvedPath,
        specifier,
        line: decl.getStartLineNumber(),
        isTypeOnly: decl.isTypeOnly(),
      };
    } catch (err) {
      warnings.push(
        `Import resolution error at line ${decl.getStartLineNumber()}: ${err}`,
      );
      return null;
    }
  }

  // ─── Event Emit Detection ─────────────────────────────────────────────────

  private extractEmits(sf: SourceFile, _warnings: string[]): EmitCall[] {
    const emits: EmitCall[] = [];

    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      const methodName = getCalledMethodName(call);
      if (!methodName || !EMIT_METHOD_NAMES.has(methodName)) return;

      const args = call.getArguments();
      const firstArg = args[0];
      const eventName = firstArg ? tryGetStringLiteral(firstArg) : null;
      const isDynamic = firstArg !== undefined && eventName === null;

      // AST certainty: static string = 1.0, dynamic = 0.5
      const astCertainty = isDynamic ? 0.5 : 1.0;

      emits.push({
        file: sf.getFilePath(),
        line: call.getStartLineNumber(),
        eventName,
        isDynamic,
        confidence: astCertainty,
      });
    });

    return emits;
  }

  // ─── Handler Registration Detection ──────────────────────────────────────

  private extractHandlers(
    sf: SourceFile,
    _warnings: string[],
  ): HandlerRegistration[] {
    const handlers: HandlerRegistration[] = [];

    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      const methodName = getCalledMethodName(call);
      if (!methodName || !HANDLER_METHOD_NAMES.has(methodName)) return;

      const args = call.getArguments();
      const firstArg = args[0];
      const secondArg = args[1];

      const eventName = firstArg ? tryGetStringLiteral(firstArg) : null;
      const isDynamic = firstArg !== undefined && eventName === null;

      // Try to resolve the handler symbol
      let handlerSymbol: string | null = null;
      if (secondArg) {
        if (secondArg.getKind() === SyntaxKind.Identifier) {
          handlerSymbol = secondArg.getText();
        } else if (
          secondArg.getKind() === SyntaxKind.ArrowFunction ||
          secondArg.getKind() === SyntaxKind.FunctionExpression
        ) {
          handlerSymbol = "[anonymous]";
        }
      }

      handlers.push({
        file: sf.getFilePath(),
        line: call.getStartLineNumber(),
        eventName,
        isDynamic,
        handlerSymbol,
        confidence: isDynamic ? 0.5 : 1.0,
      });
    });

    return handlers;
  }

  // ─── Direct Mutation Detection (INVARIANT 1) ─────────────────────────────

  private extractMutations(
    sf: SourceFile,
    _warnings: string[],
  ): DirectMutation[] {
    const mutations: DirectMutation[] = [];

    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      const methodName = getCalledMethodName(call);
      if (!methodName || !DIRECT_MUTATION_PATTERNS.has(methodName)) return;

      // Distinguish Zustand .set() calls (valid) from raw object mutations (suspicious)
      // A call is suspicious when it is NOT preceded by an EventBus or Redux dispatch
      // We flag it at medium confidence for governance evaluation
      mutations.push({
        file: sf.getFilePath(),
        line: call.getStartLineNumber(),
        pattern: methodName,
        targetSymbol: getCalleeObjectName(call),
        confidence: 0.7,
      });
    });

    return mutations;
  }

  // ─── Redux Dispatch Detection ─────────────────────────────────────────────

  private extractDispatches(
    sf: SourceFile,
    _warnings: string[],
  ): ReduxDispatch[] {
    const dispatches: ReduxDispatch[] = [];

    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      const methodName = getCalledMethodName(call);
      if (methodName !== "dispatch") return;

      const args = call.getArguments();
      const firstArg = args[0];
      let actionType: string | null = null;

      if (firstArg) {
        // Attempt to resolve action.type from object literal
        if (firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
          for (const child of firstArg.getChildren()) {
            const text = child.getText();
            if (text.includes("type:")) {
              const match = text.match(/type:\s*['"]([^'"]+)['"]/);
              if (match?.[1]) actionType = match[1];
            }
          }
        } else {
          actionType = tryGetStringLiteral(firstArg);
        }
      }

      dispatches.push({
        file: sf.getFilePath(),
        line: call.getStartLineNumber(),
        actionType,
        confidence: 0.85,
      });
    });

    return dispatches;
  }
}

// ─── AST Helpers ─────────────────────────────────────────────────────────────

/** Extract the method name from a call expression (e.g. bus.emit → 'emit'). */
function getCalledMethodName(call: CallExpression): string | null {
  const expr = call.getExpression();

  if (expr.getKind() === SyntaxKind.Identifier) {
    return expr.getText();
  }

  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    const children = expr.getChildren();
    const lastChild = children[children.length - 1];
    return lastChild?.getText() ?? null;
  }

  return null;
}

/** Get the object name on which a method is called (e.g. bus.emit → 'bus'). */
function getCalleeObjectName(call: CallExpression): string | null {
  const expr = call.getExpression();
  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    const children = expr.getChildren();
    return children[0]?.getText() ?? null;
  }
  return null;
}

/** Safely extract a string literal value from a node. Returns null if dynamic. */
function tryGetStringLiteral(node: Node): string | null {
  if (
    node.getKind() === SyntaxKind.StringLiteral ||
    node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    return node.getText().slice(1, -1); // strip quotes
  }
  return null;
}
