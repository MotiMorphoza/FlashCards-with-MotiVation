import json
import re
import subprocess
import sys
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox

# ===== CONFIG =====
HUB_DIR = Path("hub")
INDEX_FILE = Path("hubIndex.js")

LANGUAGES = [
    ("ar-he", "Arabic → Hebrew"),
    ("he-en", "Hebrew → English"),
    ("pl-en", "Polish → English"),
    ("es-he", "Spanish → Hebrew"),
    ("he-pl", "Hebrew → Polish"),
]

# ===== HELPERS =====

def normalize_id(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_\-]", "", s)
    return s

def load_index():
    if not INDEX_FILE.exists():
        return {"version": 2, "languages": [], "branches": [], "entries": []}

    text = INDEX_FILE.read_text(encoding="utf-8").strip()
    text = re.sub(r"^window\.HUB_INDEX\s*=\s*", "", text).rstrip(";")
    return json.loads(text)

def save_index(index):
    content = "window.HUB_INDEX = " + json.dumps(
        index, ensure_ascii=False, indent=2
    ) + ";"
    INDEX_FILE.write_text(content, encoding="utf-8")

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def find_entry(index, branch, group):
    for e in index["entries"]:
        if e["branch"] == branch and e["group"] == group:
            return e
    return None

# ===== APP =====

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CSVMAKER")
        self.geometry("1200x650")

        self.index = load_index()
        self._build_ui()

    # ===== UI =====

    def _build_ui(self):
        root = ttk.Frame(self, padding=10)
        root.pack(fill="both", expand=True)

        ttk.Label(root, text="Branch").grid(row=0, column=0, sticky="w")
        ttk.Label(root, text="Group / Topic").grid(row=0, column=1, sticky="w")
        ttk.Label(root, text="Filename (no .csv)").grid(row=0, column=2, sticky="w")

        self.branch_var = tk.StringVar()
        self.group_var = tk.StringVar()
        self.file_var = tk.StringVar()

        self.branch_cb = ttk.Combobox(
            root,
            textvariable=self.branch_var,
            values=[b["id"] for b in self.index["branches"]],
            width=22
        )
        self.branch_cb.grid(row=1, column=0, sticky="w")
        self.branch_cb.bind("<<ComboboxSelected>>", self.update_groups)

        self.group_cb = ttk.Combobox(
            root,
            textvariable=self.group_var,
            width=22
        )
        self.group_cb.grid(row=1, column=1, sticky="w")

        ttk.Entry(root, textvariable=self.file_var, width=22).grid(
            row=1, column=2, sticky="w"
        )

        # ---- languages ----
        lang_box = ttk.LabelFrame(root, text="Languages")
        lang_box.grid(row=2, column=0, columnspan=3, sticky="w", pady=6)

        self.lang_vars = {}
        for i, (lid, title) in enumerate(LANGUAGES):
            v = tk.BooleanVar(value=False)
            self.lang_vars[lid] = v
            ttk.Checkbutton(
                lang_box,
                text=title,
                variable=v,
                command=self.update_language_visibility
            ).grid(row=0, column=i, sticky="w")

        # ---- content ----
        self.content_box = ttk.LabelFrame(root, text="CSV Content per Language")
        self.content_box.grid(row=3, column=0, columnspan=5, sticky="nsew", pady=10)

        self.text_widgets = {}
        self.text_columns = {}

        for i, (lid, title) in enumerate(LANGUAGES):
            col = ttk.Frame(self.content_box)
            col.grid(row=0, column=i, padx=6, sticky="nsew")

            ttk.Label(col, text=title).pack(anchor="w")
            txt = tk.Text(col, width=28, height=18)
            txt.pack()

            self.text_widgets[lid] = txt
            self.text_columns[lid] = col
            col.grid_remove()

        # ---- buttons ----
        ttk.Button(
            root,
            text="SYNC FROM DISK",
            command=self.sync_from_disk
        ).grid(row=4, column=3, sticky="e", padx=6, pady=6)

        ttk.Button(
            root,
            text="GENERATE",
            command=self.generate
        ).grid(row=4, column=4, sticky="e", pady=6)

    # ===== BEHAVIOR =====

    def update_language_visibility(self):
        for lid, var in self.lang_vars.items():
            if var.get():
                self.text_columns[lid].grid()
            else:
                self.text_columns[lid].grid_remove()

    def update_groups(self, *_):
        branch = self.branch_var.get()
        if not branch:
            self.group_cb["values"] = []
            return

        groups = sorted({
            e["group"]
            for e in self.index["entries"]
            if e["branch"] == branch
        })
        self.group_cb["values"] = groups

    def sync_from_disk(self):
        try:
            subprocess.run([sys.executable, "Scanner.py"], check=True)
        except Exception as e:
            messagebox.showerror("Scanner Error", str(e))
            return

        self.index = load_index()
        self.branch_cb["values"] = [b["id"] for b in self.index["branches"]]
        self.update_groups()
        messagebox.showinfo("Done", "Index reloaded from disk")

    def generate(self):
        branch = normalize_id(self.branch_var.get())
        group = normalize_id(self.group_var.get())
        filename = normalize_id(self.file_var.get())

        if not branch or not group or not filename:
            messagebox.showerror("Error", "Branch / Group / Filename required")
            return

        selected_langs = [lid for lid, v in self.lang_vars.items() if v.get()]
        if not selected_langs:
            messagebox.showerror("Error", "Select at least one language")
            return

        if not any(b["id"] == branch for b in self.index["branches"]):
            self.index["branches"].append({"id": branch, "title": branch})
            self.branch_cb["values"] = [b["id"] for b in self.index["branches"]]

        entry = find_entry(self.index, branch, group)
        if not entry:
            entry = {"branch": branch, "group": group, "files": {}}
            self.index["entries"].append(entry)

        for lid in selected_langs:
            content = self.text_widgets[lid].get("1.0", "end").strip()
            if not content:
                continue

            if not any(l["id"] == lid for l in self.index["languages"]):
                title = dict(LANGUAGES)[lid]
                self.index["languages"].append({"id": lid, "title": title})

            target_dir = HUB_DIR / lid / branch / group
            ensure_dir(target_dir)

            path = target_dir / f"{filename}.csv"
            if path.exists():
                continue

            path.write_text(content, encoding="utf-8")

            entry["files"].setdefault(lid, [])
            if f"{filename}.csv" not in entry["files"][lid]:
                entry["files"][lid].append(f"{filename}.csv")

        save_index(self.index)
        messagebox.showinfo("Done", "HUB and hubIndex updated")

# ===== RUN =====

if __name__ == "__main__":
    App().mainloop()
