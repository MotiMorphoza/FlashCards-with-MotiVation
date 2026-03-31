import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
HUB_DIR = ROOT_DIR / "hub"
INDEX_FILE = ROOT_DIR / "hubIndex.js"

VERSION = 4
ROOT_TITLE = "Choose a topic"

LANGUAGE_TITLES = {
    "ar-he": "Arabic -> Hebrew",
    "en-pl": "English -> Polish",
    "es-he": "Spanish -> Hebrew",
    "he-en": "Hebrew -> English",
    "he-pl": "Hebrew -> Polish",
}

PREFERRED_TOPIC_ORDER = [
    "vocabulary",
    "grammer",
    "misc",
    "daily",
    "kitchen",
    "sentences",
]

TOPIC_ALIASES = {
    "daily use": "daily use",
    "daily": "daily use",
    "na co dzień": "daily use",
    "يومي": "daily use",
    "يَومِيّ": "daily use",
    "grammer": "grammer",
    "grammar": "grammer",
    "gramatyka": "grammer",
    "قواعد": "grammer",
    "قَواعِد": "grammer",
    "sentences": "sentences",
    "zdania": "sentences",
    "جمل": "sentences",
    "جُمَل": "sentences",
}


def is_csv(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() == ".csv"


def normalize_topic_name(topic_name: str) -> str:
    cleaned = topic_name.strip().replace("_", " ").lower()
    normalized = " ".join(cleaned.split())
    return TOPIC_ALIASES.get(normalized, normalized)


def sort_topics(topic_names):
    preferred_index = {name: index for index, name in enumerate(PREFERRED_TOPIC_ORDER)}
    return sorted(
        topic_names,
        key=lambda name: (preferred_index.get(name, len(PREFERRED_TOPIC_ORDER)), name),
    )


def write_index(index):
    content = "window.HUB_INDEX = " + json.dumps(
        index,
        ensure_ascii=False,
        indent=2,
    ) + ";"
    INDEX_FILE.write_text(content, encoding="utf-8")


def build_index():
    index = {
        "version": VERSION,
        "rootTitle": ROOT_TITLE,
        "languages": [],
        "topics": [],
        "entries": [],
    }

    if not HUB_DIR.exists():
        write_index(index)
        return index

    languages_seen = set()
    topics_seen = set()
    entry_map = {}

    for lang_dir in sorted(HUB_DIR.iterdir(), key=lambda item: item.name):
        if not lang_dir.is_dir():
            continue

        lang_id = lang_dir.name
        language_has_files = False

        for topic_dir in sorted(lang_dir.iterdir(), key=lambda item: item.name):
            if not topic_dir.is_dir():
                continue

            csv_files = [
                file_path
                for file_path in sorted(topic_dir.iterdir(), key=lambda item: item.name.lower())
                if is_csv(file_path)
            ]
            if not csv_files:
                continue

            topic_id = normalize_topic_name(topic_dir.name)
            if not topic_id:
                continue

            language_has_files = True
            languages_seen.add(lang_id)
            topics_seen.add(topic_id)

            if topic_id not in entry_map:
                entry_map[topic_id] = {
                    "topic": topic_id,
                    "folder": topic_dir.name,
                    "folders": {},
                    "files": {},
                }

            entry = entry_map[topic_id]
            entry["folders"][lang_id] = topic_dir.name
            entry["files"].setdefault(lang_id, [])

            for file_path in csv_files:
                entry["files"][lang_id].append(file_path.name)

        if not language_has_files:
            continue

    for language_id in sorted(languages_seen):
        index["languages"].append(
            {
                "id": language_id,
                "title": LANGUAGE_TITLES.get(language_id, language_id),
            }
        )

    for topic_id in sort_topics(topics_seen):
        index["topics"].append(
            {
                "id": topic_id,
                "title": topic_id,
            }
        )
        index["entries"].append(entry_map[topic_id])

    write_index(index)
    return index


if __name__ == "__main__":
    result = build_index()
    print(
        f"Rebuilt hubIndex.js with {len(result['languages'])} languages, "
        f"{len(result['topics'])} topics, and {len(result['entries'])} entries."
    )
