import json
import re
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox

INDEX_FILE = Path("hubIndex.js")
HUB_DIR = Path("hub")

BRANCHES = [
    ("grammar", "דקדוק"),
    ("vocabulary", "אוצר מילים"),
    ("advanced", "מתקדם"),
]


# ---------- helpers ----------

def load_index():
    if not INDEX_FILE.exists():
        return {"branches": [], "languages": [], "topics": []}

    text = INDEX_FILE.read_text(encoding="utf-8")
    text = re.sub(r"^window\.HUB_INDEX\s*=\s*", "", text.strip()).rstrip(";")
    return json.loads(text)


def save_index(index):
    content = "window.HUB_INDEX = " + json.dumps(
        index, ensure_ascii=False, indent=2
    ) + ";"
    INDEX_FILE.write_text(content, encoding="utf-8")


def normalize_id(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_\-]", "", s)
    return s


# ---------- GUI ----------

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CSV Hub Tool")
        self.geometry("900x600")

        self.index = load_index()
        self.languages = [l["id"] for l in self.index.get("languages", [])]
        self.topics = {t["id"]: t for t in self.index.get("topics", [])}

        self._build_ui()

    def _build_ui(self):
        frm = ttk.Frame(self, padding=10)
        frm.pack(fill="both", expand=True)

        # Branch
        ttk.Label(frm, text="Branch").grid(row=0, column=0, sticky="w")
        self.branch_var = tk.StringVar()
        self.branch_cb = ttk.Combobox(
            frm,
            textvariable=self.branch_var,
            values=[b[0] for b in BRANCHES],
            state="readonly",
            width=20
        )
        self.branch_cb.grid(row=1, column=0, sticky="w")

        # Topic
        ttk.Label(frm, text="Topic").grid(row=0, column=1, sticky="w")
        self.topic_var = tk.StringVar()
        self.topic_cb = ttk.Combobox(
            frm,
            textvariable=self.topic_var,
            values=sorted(self.topics.keys()),
            width=30
        )
        self.topic_cb.grid(row=1, column=1, sticky="w")
        self.topic_cb.bind("<<ComboboxSelected>>", self.on_topic_selected)

        # Filename
        ttk.Label(frm, text="Filename (logical)").grid(row=0, column=2, sticky="w")
        self.filename_var = tk.StringVar()
        ttk.Entry(frm, textvariable=self.filename_var, width=30).grid(row=1, column=2, sticky="w")

        # Languages
        langs_frame = ttk.LabelFrame(frm, text="Languages")
        langs_frame.grid(row=2, column=0, columnspan=3, sticky="w", pady=10)

        self.lang_vars = {}
        for i, lang in enumerate(self.languages):
            v = tk.BooleanVar(value=False)
            self.lang_vars[lang] = v
            cb = ttk.Checkbutton(
                langs_frame,
                text=lang,
                variable=v,
                command=self.update_language_visibility
            )
            cb.grid(row=0, column=i, sticky="w")

        # Text areas
        self.text_frame = ttk.LabelFrame(frm, text="Content (CSV lines)")
        self.text_frame.grid(row=3, column=0, columnspan=3, sticky="nsew", pady=10)

        self.text_widgets = {}
        self.text_columns = {}

        for i, lang in enumerate(self.languages):
            col = ttk.Frame(self.text_frame)
            col.grid(row=0, column=i, padx=5, sticky="nsew")
            ttk.Label(col, text=lang).pack(anchor="w")
            txt = tk.Text(col, width=30, height=15)
            txt.pack()
            self.text_widgets[lang] = txt
            self.text_columns[lang] = col

            col.grid_remove()  # מוסתר כברירת מחדל

        # Generate
        ttk.Button(frm, text="Generate", command=self.generate).grid(row=4, column=2, sticky="e")

    # ---------- behavior ----------

    def on_topic_selected(self, _):
        topic_id = self.topic_var.get()
        topic = self.topics.get(topic_id)
        if topic and topic.get("branch"):
            self.branch_var.set(topic["branch"])
            self.branch_cb.config(state="disabled")
        else:
            self.branch_cb.config(state="readonly")

    def update_language_visibility(self):
        for lang, var in self.lang_vars.items():
            if var.get():
                self.text_columns[lang].grid()
            else:
                self.text_columns[lang].grid_remove()

    def generate(self):
        topic = normalize_id(self.topic_var.get())
        filename = normalize_id(self.filename_var.get())
        branch = self.branch_var.get()

        if not topic or not filename:
            messagebox.showerror("Error", "Topic and filename are required")
            return

        topic_exists = topic in self.topics

        # New topic → branch חובה ונשמר ל-index
        if not topic_exists:
            if not branch:
                messagebox.showerror("Error", "Branch is required for new topic")
                return

            new_topic = {
                "id": topic,
                "branch": branch,
                "files": {}
            }
            self.index["topics"].append(new_topic)
            self.topics[topic] = new_topic
            save_index(self.index)

        selected_langs = [l for l, v in self.lang_vars.items() if v.get()]
        if not selected_langs:
            messagebox.showerror("Error", "Select at least one language")
            return

        # Write CSV files
        for lang in selected_langs:
            content = self.text_widgets[lang].get("1.0", "end").strip()
            if not content:
                continue

            target_dir = HUB_DIR / lang / topic
            target_dir.mkdir(parents=True, exist_ok=True)

            path = target_dir / f"{lang}_{filename}.csv"
            if path.exists():
                continue  # no overwrite

            with path.open("w", encoding="utf-8", newline="") as f:
                                f.write(content)

        # Run scanner
        subprocess.run(["python", "scanner.py"], check=False)

        messagebox.showinfo("Done", "Files created and index updated")


if __name__ == "__main__":
    App().mainloop()
