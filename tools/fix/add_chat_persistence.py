#!/usr/bin/env python3
"""
add_chat_persistence.py — adds localStorage-backed conversation history to useAGI

Changes (4 targeted replacements in apps/r3-agi/src/store/useAGI.ts):
  1. Insert CHAT_KEY, CHAT_CAP, loadChat(), saveChat() before INITIAL_PRIOS
  2. Initialize chatMessages from loadChat() instead of []
  3. addChatMessage: cap at CHAT_CAP and save to localStorage
  4. clearChat: remove localStorage key before resetting state

Design:
  - Uses localStorage (survives page refresh, unlike sessionStorage used by prios)
  - Key: "r3-chat-v1" — bump to v2 if message schema changes
  - Cap: 50 messages — keeps most recent, trims oldest
  - Both load and save wrapped in try/catch — storage quota or corruption fails silently

Usage:
  python3 add_chat_persistence.py          # dry run
  python3 add_chat_persistence.py --apply  # write
"""
import argparse, shutil, sys
from datetime import datetime
from pathlib import Path

ROOT      = Path.home() / "Agi-Suite"
TARGET    = ROOT / "apps/r3-agi/src/store/useAGI.ts"
BACKUP    = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")
def fail(m): print(f"  \033[91m✘\033[0m  {m}"); sys.exit(1)


# ── Replacement 1: insert chat helpers before INITIAL_PRIOS ───────────────────
R1_OLD = "const INITIAL_PRIOS: PrioItem[] = ["

R1_NEW = """\
// ─── Chat persistence (localStorage) ─────────────────────────────────────────
const CHAT_KEY = "r3-chat-v1";
const CHAT_CAP = 50;

function loadChat(): { role: "user" | "assistant"; content: string }[] {
  try {
    const s = localStorage.getItem(CHAT_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore — storage unavailable or data corrupted */
  }
  return [];
}

function saveChat(msgs: { role: "user" | "assistant"; content: string }[]) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(msgs));
  } catch {
    /* ignore — storage quota exceeded */
  }
}

const INITIAL_PRIOS: PrioItem[] = ["""


# ── Replacement 2: initialize chatMessages from localStorage ──────────────────
R2_OLD = "  chatMessages: [],"
R2_NEW = "  chatMessages: loadChat(),"


# ── Replacement 3: addChatMessage — cap and persist ───────────────────────────
R3_OLD = """\
  addChatMessage: (role, content) => {
    set((s) => ({ chatMessages: [...s.chatMessages, { role, content }] }));
    if (role === "user")
      get().addLog("QUERY", content.substring(0, 60), "lt-cmd");
    else get().addLog("AGENT", content.substring(0, 60), "lt-fix");
  },"""

R3_NEW = """\
  addChatMessage: (role, content) => {
    set((s) => {
      const msgs = [...s.chatMessages, { role, content }].slice(-CHAT_CAP);
      saveChat(msgs);
      return { chatMessages: msgs };
    });
    if (role === "user")
      get().addLog("QUERY", content.substring(0, 60), "lt-cmd");
    else get().addLog("AGENT", content.substring(0, 60), "lt-fix");
  },"""


# ── Replacement 4: clearChat — remove localStorage key ───────────────────────
R4_OLD = """\
  clearChat: () => {
    set({ chatMessages: [] });
    get().addLog("CLEAR", "Chat cleared", "lt-cmd");
  },"""

R4_NEW = """\
  clearChat: () => {
    localStorage.removeItem(CHAT_KEY);
    set({ chatMessages: [] });
    get().addLog("CLEAR", "Chat cleared", "lt-cmd");
  },"""


REPLACEMENTS = [
    (R1_OLD, R1_NEW, "insert chat helpers before INITIAL_PRIOS"),
    (R2_OLD, R2_NEW, "initialize chatMessages from loadChat()"),
    (R3_OLD, R3_NEW, "addChatMessage: cap at 50 + save to localStorage"),
    (R4_OLD, R4_NEW, "clearChat: removeItem from localStorage"),
]


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}add_chat_persistence.py{X}  [{mode}]\n")

    if not TARGET.exists():
        fail(f"Not found: {TARGET.relative_to(ROOT)}")

    content = TARGET.read_text()

    for old, new, label in REPLACEMENTS:
        count = content.count(old)
        if count == 0:
            fail(f"Anchor not found (file may have changed): {label}\n    '{old[:60]}'")
        if count > 1:
            fail(f"Anchor appears {count}× — expected 1: {label}")
        info(label)
        content = content.replace(old, new)

    # Post-replacement assertions
    assert "loadChat()" in content,         "loadChat() not in result"
    assert "saveChat(msgs)" in content,     "saveChat() not in result"
    assert "CHAT_CAP" in content,           "CHAT_CAP not in result"
    assert "localStorage.removeItem" in content, "removeItem not in result"
    assert "chatMessages: loadChat()," in content, "init not replaced"
    assert content.count("chatMessages: [],") == 0, "old init still present"

    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TARGET, BACKUP / "useAGI.ts")
        TARGET.write_text(content)
        ok(f"Written: {TARGET.relative_to(ROOT)}")
        ok(f"Backup:  .patch-backups/{BACKUP.name}/useAGI.ts")
        print()
        print("Next steps:")
        print("  pnpm --filter @workspace/r3-agi typecheck")
        print("  pnpm dev  →  refresh browser  →  send a message")
        print("  refresh again  →  message history should persist")
    else:
        dry(f"Would write: {TARGET.relative_to(ROOT)}")
        print()
        print(f"{Y}Dry run — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    run(p.parse_args().apply)
