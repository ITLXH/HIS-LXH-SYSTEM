from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "supabase" / "his_restore_from_omc_registration.sql"
OUTDIR = ROOT / "supabase" / "restore_chunks"
MAX_CHARS = 160_000

BASE_TABLES = [
    "Patients",
    "Visits",
    "Appointments",
    "Organizations",
    "Service_Lists",
    "MasterData",
    "Locations",
    "Drugs_Master",
    "Labs_Master",
    "Vaccines_Master",
    "Patient_Vaccines",
    "Users",
    "Settings",
    "activity_logs",
    "Admissions",
    "Wards",
    "Rooms",
    "Beds",
    "Progress_Notes",
    "IPD_Medications",
    "IPD_Vital_Signs",
    "Nursing_Notes",
    "IPD_Visits",
]


def split_statements(sql: str) -> list[str]:
    statements: list[str] = []
    start = 0
    in_quote = False
    i = 0
    while i < len(sql):
        char = sql[i]
        if char == "'":
            if in_quote and i + 1 < len(sql) and sql[i + 1] == "'":
                i += 2
                continue
            in_quote = not in_quote
        elif char == ";" and not in_quote:
            statement = sql[start : i + 1].strip()
            if statement and statement not in {"BEGIN;", "COMMIT;"}:
                statements.append(statement)
            start = i + 1
        i += 1
    tail = sql[start:].strip()
    if tail:
        statements.append(tail)
    return statements


def write_chunk(index: int, statements: list[str]) -> None:
    content = "\n\n".join(statements).strip() + "\n"
    (OUTDIR / f"{index:02d}_restore.sql").write_text(content, encoding="utf-8")


def main() -> None:
    OUTDIR.mkdir(parents=True, exist_ok=True)
    for old in OUTDIR.glob("*.sql"):
        old.unlink()

    clean_parts = ["-- Run first: remove old HIS tables and earlier unprefixed restore tables."]
    for name in reversed(BASE_TABLES):
        clean_parts.append(f'DROP TABLE IF EXISTS public."HIS_One_{name}" CASCADE;')
    for name in reversed(BASE_TABLES):
        clean_parts.append(f'DROP TABLE IF EXISTS public."{name}" CASCADE;')
    (OUTDIR / "00_clean_old_tables.sql").write_text("\n".join(clean_parts) + "\n", encoding="utf-8")

    statements = split_statements(INPUT.read_text(encoding="utf-8"))
    schema_statements = [stmt for stmt in statements if not stmt.lstrip().upper().startswith("INSERT INTO ")]
    schema_sql = "\n\n".join(schema_statements).strip()
    schema_sql += "\n\nCOMMIT;\n\nNOTIFY pgrst, 'reload schema';\n"
    (OUTDIR / "01_schema_only.sql").write_text(schema_sql, encoding="utf-8")

    statements = [stmt for stmt in statements if stmt.lstrip().upper().startswith("INSERT INTO ")]
    chunk: list[str] = []
    chunk_len = 0
    index = 1
    for statement in statements:
        projected = chunk_len + len(statement) + 2
        if chunk and projected > MAX_CHARS:
            write_chunk(index, chunk)
            index += 1
            chunk = []
            chunk_len = 0
        chunk.append(statement)
        chunk_len += len(statement) + 2
    if chunk:
        write_chunk(index, chunk)

    print(f"Wrote {index} restore chunks to {OUTDIR}")


if __name__ == "__main__":
    main()
