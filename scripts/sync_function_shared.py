"""Copy shared validation code into supabase/functions/_shared/ for Edge Functions.

Edge Functions can only import files inside supabase/functions/, so the browser's
schemas are copied verbatim (CI fails if the copies drift).
Usage: python3 -I scripts/sync_function_shared.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "packages" / "shared" / "src"
DST = ROOT / "supabase" / "functions" / "_shared"
HEADER = "// Generated from packages/shared/src by scripts/sync_function_shared.py — do not edit.\n"

for name in ("enums.ts", "submissions.ts", "sop.ts", "sopText.ts", "deadlines.ts", "daadImport.ts"):
    (DST / name).write_text(HEADER + (SRC / name).read_text(encoding="utf-8"), encoding="utf-8")
    print(f"synced {name}")
