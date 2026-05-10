#!/usr/bin/env bash
set -euo pipefail
PANEL="artifacts/r3-agi/src/components/AgentSuitePanel.tsx"

# 1. Add getAuthHeaders import at top of file (after existing imports)
sed -i 's|import { useAGI } from "../store/useAGI";|import { useAGI } from "../store/useAGI";\nimport { getAuthHeaders } from "../lib/api-secret";|' "$PANEL"

# 2. Add controllerRef inside ChatPanel (after the bottomRef declaration)
sed -i 's|const bottomRef = useRef<HTMLDivElement>(null);|const bottomRef = useRef<HTMLDivElement>(null);\n  const controllerRef = useRef<AbortController \| null>(null);|' "$PANEL"

# 3. Add AbortController creation and auth header in send(), replace the fetch call
sed -i 's|const res = await fetch("/api/agent/chat", {|const controller = new AbortController();\n      controllerRef.current = controller;\n      const res = await fetch("/api/agent/chat", {|' "$PANEL"

sed -i 's|headers: { "Content-Type": "application/json" },|headers: { "Content-Type": "application/json", ...getAuthHeaders() },\n          signal: controller.signal,|' "$PANEL"

# 4. Clear controllerRef in finally block
sed -i 's|} finally {|} finally {\n      controllerRef.current = null;|' "$PANEL"

# 5. Detect AbortError in catch — do not surface as error
sed -i 's|} catch (e: unknown) {|} catch (e: unknown) {\n      if (e instanceof Error \&\& e.name === "AbortError") return; // intentional cancel|' "$PANEL"

# 6. Add Cancel button alongside SEND button (insert after the SEND button closing tag)
# This is complex to sed reliably — do it as a printf insert
python3 - << 'PY'
import re, pathlib

panel = pathlib.Path("artifacts/r3-agi/src/components/AgentSuitePanel.tsx")
content = panel.read_text()

cancel_btn = '''        {busy && (
          <button
            onClick={() => { controllerRef.current?.abort(); }}
            style={{
              background: "transparent",
              border: `1px solid ${T.z700}`,
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "pointer",
              color: T.z400,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
              transition: "all 0.2s",
            }}
          >
            CANCEL
          </button>
        )}'''

# Insert cancel button after the closing </button> of the SEND button
content = content.replace(
    "        </button>\n      </div>\n    </div>\n  );\n}\n\n// ─── Conversation persistence",
    f"        </button>\n{cancel_btn}\n      </div>\n    </div>\n  );\n}}\n\n// ─── Conversation persistence"
)
panel.write_text(content)
print("✓ Cancel button inserted")
PY

echo "✓ AgentSuitePanel patches applied"
