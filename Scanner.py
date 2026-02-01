import json
from pathlib import Path

HUB_DIR = Path("hub")
INDEX_FILE = Path("hubIndex.js")

VERSION = 2

# -------- helpers --------

def write_index(index):
    content = "window.HUB_INDEX = " + json.dumps(
        index, ensure_ascii=False, indent=2
    ) + ";"
    INDEX_FILE.write_text(content, encoding="utf-8")

def is_csv(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() == ".csv"

# -------- scan --------

def scan_hub():
    index = {
        "version": VERSION,
        "languages": [],
        "branches": [],
        "entries": []
    }

    if not HUB_DIR.exists():
        write_index(index)
        return

    languages_seen = set()
    branches_seen = set()
    entry_map = {}  # (branch, group) -> entry

    for lang_dir in HUB_DIR.iterdir():
        if not lang_dir.is_dir():
            continue

        lang_id = lang_dir.name
        languages_seen.add(lang_id)

        for branch_dir in lang_dir.iterdir():
            if not branch_dir.is_dir():
                continue

            branch_id = branch_dir.name
            branches_seen.add(branch_id)

            for group_dir in branch_dir.iterdir():
                if not group_dir.is_dir():
                    continue

                group_id = group_dir.name
                key = (branch_id, group_id)

                if key not in entry_map:
                    entry = {
                        "branch": branch_id,
                        "group": group_id,
                        "files": {}
                    }
                    entry_map[key] = entry
                    index["entries"].append(entry)

                entry = entry_map[key]
                entry["files"].setdefault(lang_id, [])

                for file in group_dir.iterdir():
                    if is_csv(file):
                        entry["files"][lang_id].append(file.name)

    # finalize languages
    for lid in sorted(languages_seen):
        index["languages"].append({
            "id": lid,
            "title": lid
        })

    # finalize branches
    for bid in sorted(branches_seen):
        index["branches"].append({
            "id": bid,
            "title": bid
        })

    write_index(index)

# -------- run --------

if __name__ == "__main__":
    scan_hub()
    print("✓ hubIndex.js rebuilt from hub/")
