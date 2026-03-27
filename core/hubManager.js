import { AudioEngine } from "./audio.js";
import { EventBus } from "./eventBus.js";
import { HubAdapter } from "./hubAdapter.js";
import { Router } from "./router.js";
import { SessionEngine } from "./engine.js";
import { SpeechEngine } from "./speech.js";
import { Storage } from "./storage.js";
import { FlashCardsGame } from "../games/flashcards.js";
import { WordMatchGame } from "../games/wordmatch.js";
import { WordPuzzleGame } from "../games/wordpuzzle.js";
import { renderAccordionTree } from "../ui/accordion.js";
import { renderLibraryRows, renderLibraryTopics } from "../ui/library.js";
import { Modal } from "../ui/modals.js";
import { renderStats } from "../ui/stats.js";
import { parseCsv } from "../utils/csv.js";
import { normalizeWhitespace } from "../utils/text.js";

const GAME_REGISTRY = {
  flashcards: FlashCardsGame,
  wordmatch: WordMatchGame,
  wordpuzzle: WordPuzzleGame,
};

function getCategoryForTopic(topicName, record = {}) {
  return HubAdapter.inferCategory(topicName, record);
}

function getAllowedGamesForTopic(topicName, record = {}) {
  return HubAdapter.getAllowedGamesForTopic(topicName, record);
}

function getGameLabel(gameId) {
  const labels = {
    flashcards: "Flash Cards",
    wordmatch: "Word Match",
    wordpuzzle: "Word Puzzle",
  };

  return labels[gameId] || "Session";
}

function getLibrarySourceLabel(topic) {
  if (topic.source === "hub-copy") {
    return "Saved from hub";
  }

  if (topic.source === "import") {
    return "Imported file";
  }

  return "Created locally";
}

function createCsvBlob(rows) {
  const lines = ['"Source","Target"'];

  rows.forEach((row) => {
    const source = String(row.source || "").replace(/"/g, '""');
    const target = String(row.target || "").replace(/"/g, '""');
    lines.push(`"${source}","${target}"`);
  });

  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

function flattenTopicTree(tree) {
  const records = [];

  Object.values(tree).forEach((groups) => {
    Object.values(groups).forEach((topics) => {
      topics.forEach((topic) => {
        records.push({
          ...topic,
          rowsCount:
            typeof topic.rowsCount === "number"
              ? topic.rowsCount
              : Array.isArray(topic.rows)
                ? topic.rows.length
                : null,
        });
      });
    });
  });

  return records;
}

class HubManager {
  constructor() {
    this.router = new Router();
    this.activeGame = null;
    this.selectedLang = null;
    this.selectedGame = null;
    this.selectedTopic = null;
    this.editingTopicId = null;
    this.importContext = null;
  }

  init() {
    this.cacheDom();
    this.registerScreens();
    this.restorePreferences();
    HubAdapter.init();
    this.populateLanguages();
    this.populateLibraryLanguages();
    this.populateLibraryTopicOptions();
    this.bindUi();
    this.bindAppEvents();
    this.router.navigate("home", { record: false });
    this.renderLibraryTopicList();
    this.registerServiceWorker();
  }

  cacheDom() {
    this.dom = {
      home: document.getElementById("screen-home"),
      library: document.getElementById("screen-library"),
      libraryEditor: document.getElementById("screen-library-editor"),
      game: document.getElementById("screen-game"),
      stats: document.getElementById("screen-stats"),
      contact: document.getElementById("screen-contact"),
      languageSelect: document.getElementById("languageSelect"),
      gameButtons: [...document.querySelectorAll("[data-game]")],
      topicPanel: document.getElementById("topicPanel"),
      topicTree: document.getElementById("topicTree"),
      startButton: document.getElementById("startTopicButton"),
      openLibraryButton: document.getElementById("openLibraryButton"),
      libraryLangSelect: document.getElementById("libraryLangSelect"),
      libraryTopicInput: document.getElementById("libraryTopicInput"),
      libraryTopicOptions: document.getElementById("libraryTopicOptions"),
      libraryTopicNameInput: document.getElementById("libraryTopicNameInput"),
      createLibraryTopicButton: document.getElementById("createLibraryTopicButton"),
      importLibraryFileButton: document.getElementById("importLibraryFileButton"),
      libraryTopicsMount: document.getElementById("libraryTopicsMount"),
      backFromLibraryButton: document.getElementById("backFromLibraryButton"),
      libraryEditorTitle: document.getElementById("libraryEditorTitle"),
      libraryEditorMeta: document.getElementById("libraryEditorMeta"),
      addLibraryRowButton: document.getElementById("addLibraryRowButton"),
      exportLibraryTopicButton: document.getElementById("exportLibraryTopicButton"),
      renameLibraryTopicButton: document.getElementById("renameLibraryTopicButton"),
      deleteLibraryTopicButton: document.getElementById("deleteLibraryTopicButton"),
      librarySearchInput: document.getElementById("librarySearchInput"),
      libraryRowsMount: document.getElementById("libraryRowsMount"),
      backFromLibraryEditorButton: document.getElementById("backFromLibraryEditorButton"),
      openStatsButton: document.getElementById("openStatsButton"),
      gameMount: document.getElementById("gameMount"),
      statsMount: document.getElementById("statsMount"),
      backFromStatsButton: document.getElementById("backFromStatsButton"),
      openContactButton: document.getElementById("openContactButton"),
      backFromContactButton: document.getElementById("backFromContactButton"),
      resetStatsButton: document.getElementById("resetStatsButton"),
      toggleSound: document.getElementById("toggleSound"),
      toggleSpeech: document.getElementById("toggleSpeech"),
      importFileInput: document.getElementById("importFileInput"),
    };
  }

  registerScreens() {
    this.router.register("home", this.dom.home);
    this.router.register("library", this.dom.library);
    this.router.register("libraryEditor", this.dom.libraryEditor);
    this.router.register("game", this.dom.game);
    this.router.register("stats", this.dom.stats);
    this.router.register("contact", this.dom.contact);
  }

  restorePreferences() {
    AudioEngine.setEnabled(Storage.getPreference("audioEnabled", true));
    SpeechEngine.setEnabled(Storage.getPreference("speechEnabled", true));
    this.updateToggleLabels();
  }

  bindUi() {
    this.dom.languageSelect.addEventListener("change", (event) => {
      this.handleLanguageChange(event.target.value);
    });

    this.dom.gameButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.handleGameSelection(button.dataset.game);
      });
    });

    this.dom.startButton.addEventListener("click", () => {
      this.startSelectedTopic();
    });

    this.dom.openLibraryButton.addEventListener("click", () => {
      this.showLibrary();
    });

    this.dom.libraryLangSelect.addEventListener("change", () => {
      this.renderLibraryTopicList();
    });

    this.dom.libraryTopicInput.addEventListener("input", () => {
      this.renderLibraryTopicList();
    });

    this.dom.createLibraryTopicButton.addEventListener("click", () => {
      this.createLibraryTopic();
    });

    this.dom.importLibraryFileButton.addEventListener("click", () => {
      this.triggerLibraryImport();
    });

    this.dom.backFromLibraryButton.addEventListener("click", () => {
      this.showHome();
    });

    this.dom.backFromLibraryEditorButton.addEventListener("click", () => {
      this.showHome();
    });

    this.dom.librarySearchInput.addEventListener("input", () => {
      this.renderLibraryEditor();
    });

    this.dom.addLibraryRowButton.addEventListener("click", () => {
      this.addLibraryRow();
    });

    this.dom.renameLibraryTopicButton.addEventListener("click", () => {
      this.renameLibraryTopic();
    });

    this.dom.exportLibraryTopicButton.addEventListener("click", () => {
      this.exportLibraryTopic();
    });

    this.dom.deleteLibraryTopicButton.addEventListener("click", () => {
      this.deleteLibraryTopic();
    });

    this.dom.openStatsButton.addEventListener("click", () => {
      this.showStats();
    });

    this.dom.backFromStatsButton.addEventListener("click", () => {
      this.showHome();
    });

    this.dom.openContactButton.addEventListener("click", () => {
      this.showContact();
    });

    this.dom.backFromContactButton.addEventListener("click", () => {
      this.showHome();
    });

    this.dom.resetStatsButton.addEventListener("click", async () => {
      const confirmed = await Modal.confirm(
        "Delete saved sessions, records, and hard-item counts?",
      );

      if (!confirmed) {
        return;
      }

      Storage.clearNamespace("sessions");
      Storage.clearNamespace("best");
      Storage.clearNamespace("hard");
      this.showStats();
    });

    this.dom.toggleSound.addEventListener("click", () => {
      const enabled = AudioEngine.toggle();
      Storage.setPreference("audioEnabled", enabled);
      this.updateToggleLabels();
    });

    this.dom.toggleSpeech.addEventListener("click", () => {
      const enabled = SpeechEngine.toggle();
      Storage.setPreference("speechEnabled", enabled);
      this.updateToggleLabels();
    });

    this.dom.importFileInput.addEventListener("change", async (event) => {
      await this.handleImportedFile(event.target.files?.[0] || null);
      event.target.value = "";
    });
  }

  bindAppEvents() {
    EventBus.on("app:show-home", () => {
      this.showHome();
    });

    EventBus.on("app:restart-topic", () => {
      this.restartTopic();
    });
  }

  updateToggleLabels() {
    this.dom.toggleSound.textContent = AudioEngine.enabled ? "Sound on" : "Sound off";
    this.dom.toggleSpeech.textContent = SpeechEngine.enabled
      ? "Speech on"
      : "Speech off";
  }

  populateLanguages() {
    this.dom.languageSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a language pair";
    this.dom.languageSelect.appendChild(placeholder);

    HubAdapter.getLanguages().forEach((language) => {
      const option = document.createElement("option");
      option.value = language.id;
      option.textContent = language.title;
      this.dom.languageSelect.appendChild(option);
    });
  }

  populateLibraryLanguages() {
    this.dom.libraryLangSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "All languages / choose one";
    this.dom.libraryLangSelect.appendChild(placeholder);

    HubAdapter.getLanguages().forEach((language) => {
      const option = document.createElement("option");
      option.value = language.id;
      option.textContent = language.title;
      this.dom.libraryLangSelect.appendChild(option);
    });
  }

  populateLibraryTopicOptions() {
    const currentValue = this.dom.libraryTopicInput.value;
    const suggestions = HubAdapter.getTopicSuggestions();

    this.dom.libraryTopicOptions.innerHTML = "";

    suggestions.forEach((topicName) => {
      const option = document.createElement("option");
      option.value = topicName;
      this.dom.libraryTopicOptions.appendChild(option);
    });

    if (currentValue) {
      this.dom.libraryTopicInput.value = HubAdapter.normalizeTopicName(currentValue);
    }
  }

  handleLanguageChange(lang) {
    this.selectedLang = lang || null;
    this.selectedGame = null;
    this.selectedTopic = null;
    this.dom.topicPanel.hidden = true;
    this.dom.startButton.disabled = true;
    this.dom.startButton.textContent = "Select a topic first";
    this.dom.topicTree.innerHTML = "";

    this.dom.gameButtons.forEach((button) => {
      button.classList.remove("is-selected");
    });
  }

  handleGameSelection(gameId) {
    if (!this.selectedLang) {
      Modal.alert("Choose a language pair first.");
      return;
    }

    this.selectedGame = gameId;
    this.selectedTopic = null;
    this.dom.startButton.disabled = true;
    this.dom.startButton.textContent = "Select a topic first";

    this.dom.gameButtons.forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.game === gameId);
    });

    this.renderTopicTree();
  }

  renderTopicTree() {
    if (!this.selectedLang || !this.selectedGame) {
      return;
    }

    const tree = HubAdapter.buildTree(this.selectedLang, {
      gameId: this.selectedGame,
    });

    this.dom.topicPanel.hidden = false;
    this.dom.topicTree.innerHTML = "";
    this.dom.topicTree.appendChild(
      renderAccordionTree(tree, {
        selectedId: this.selectedTopic?.id || null,
        onSelect: (fileMeta) => {
          this.selectedTopic = fileMeta;
          this.dom.startButton.disabled = false;
          this.dom.startButton.textContent = `Start ${getGameLabel(this.selectedGame)}`;
          this.renderTopicTree();
        },
      }),
    );
  }

  async startSelectedTopic() {
    if (!this.selectedGame || !this.selectedTopic) {
      Modal.alert("Select both a game and a topic.");
      return;
    }

    this.dom.startButton.disabled = true;
    this.dom.startButton.textContent = "Loading...";

    try {
      await this.launchGame(this.selectedGame, this.selectedTopic);
      this.dom.startButton.textContent = `Start ${getGameLabel(this.selectedGame)}`;
      this.dom.startButton.disabled = false;
    } catch (error) {
      Modal.error(`Could not start the session: ${error.message}`);
      this.dom.startButton.disabled = false;
      this.dom.startButton.textContent = `Start ${getGameLabel(this.selectedGame)}`;
    }
  }

  createUniqueTopicName(baseName, lang, topicName, excludeId = null) {
    const cleanBase = normalizeWhitespace(baseName) || "Untitled";

    if (!Storage.topicTitleExists(cleanBase, { lang, topicName, excludeId })) {
      return cleanBase;
    }

    let index = 2;
    let candidate = `${cleanBase} (${index})`;

    while (Storage.topicTitleExists(candidate, { lang, topicName, excludeId })) {
      index += 1;
      candidate = `${cleanBase} (${index})`;
    }

    return candidate;
  }

  async prepareTopicForLaunch(gameId, topicMeta) {
    const topicName = topicMeta.topicName || HubAdapter.normalizeTopicName(topicMeta.topic);
    const category = topicMeta.category || getCategoryForTopic(topicName, topicMeta);
    const allowedGames = topicMeta.allowedGames || getAllowedGamesForTopic(topicName, topicMeta);

    if (topicMeta.source === "hub") {
      const localCopy = Storage.findLibraryTopicByOrigin(topicMeta.path);

      if (localCopy) {
        return {
          topicMeta: {
            ...localCopy,
            localId: localCopy.id,
          },
          data: localCopy.rows,
        };
      }

      const rows = await HubAdapter.loadTopic(topicMeta);
      const localizedName = this.createUniqueTopicName(
        topicMeta.name,
        topicMeta.lang,
        topicName,
      );
      const localTopic = HubAdapter.ensureLocalTopic(
        {
          ...topicMeta,
          name: localizedName,
        },
        rows,
        {
          category,
          allowedGames,
        },
      );

      return {
        topicMeta: {
          ...localTopic,
          localId: localTopic.id,
        },
        data: localTopic.rows,
      };
    }

    const data = await HubAdapter.loadTopic(topicMeta);
    return { topicMeta, data };
  }

  async launchGame(gameId, topicMeta) {
    const prepared = await this.prepareTopicForLaunch(gameId, topicMeta);
    this.selectedTopic = prepared.topicMeta;

    if (this.selectedTopic.lang) {
      this.selectedLang = this.selectedTopic.lang;
      this.dom.languageSelect.value = this.selectedLang;
    }

    this.selectedGame = gameId;
    this.renderTopicTree();

    return this.launchGameWithData(gameId, prepared.topicMeta, prepared.data);
  }

  async launchGameWithData(gameId, topicMeta, data) {
    this.destroyActiveGame();

    if (!data.length) {
      throw new Error("The selected file does not contain usable rows.");
    }

    const GameModule = GAME_REGISTRY[gameId];
    if (!GameModule) {
      throw new Error(`Unknown game "${gameId}"`);
    }

    const engine = new SessionEngine(gameId, {
      id: topicMeta.id,
      name: topicMeta.name,
      path: topicMeta.path,
      lang: topicMeta.lang,
      topicName: topicMeta.topicName,
    });

    this.activeGame = new GameModule();
    await this.activeGame.init(
      this.dom.gameMount,
      {
        lang: topicMeta.lang,
        topic: topicMeta,
        data,
      },
      engine,
    );

    this.router.navigate("game");
  }

  triggerLibraryImport() {
    const lang = this.dom.libraryLangSelect.value;
    const rawTopicName = normalizeWhitespace(this.dom.libraryTopicInput.value);

    if (!lang) {
      Modal.alert("Choose a language pair for the local library import.");
      return;
    }

    if (!rawTopicName) {
      Modal.alert("Type or choose a topic for the library import.");
      return;
    }

    const topicName = HubAdapter.normalizeTopicName(rawTopicName);
    const category = getCategoryForTopic(topicName);

    this.importContext = {
      lang,
      topicName,
      category,
      allowedGames: getAllowedGamesForTopic(topicName),
      autoLaunch: false,
    };

    this.dom.importFileInput.click();
  }

  async handleImportedFile(file) {
    if (!file) {
      return;
    }

    const context = this.importContext;
    this.importContext = null;

    if (!context?.lang || !context?.topicName) {
      Modal.alert("The import target is missing. Choose a language and topic first.");
      return;
    }

    try {
      const text = await file.text();
      const data = parseCsv(text, `import-${file.name}`);

      if (!data.length) {
        throw new Error("The selected CSV file does not contain usable rows.");
      }

      const baseName = file.name.replace(/\.[^/.]+$/, "").trim() || "Imported file";
      const uniqueName = this.createUniqueTopicName(
        baseName,
        context.lang,
        context.topicName,
      );
      const topic = Storage.createLibraryTopic({
        name: uniqueName,
        fileName: file.name,
        lang: context.lang,
        topicName: context.topicName,
        source: "import",
        category: context.category,
        allowedGames: context.allowedGames,
        rows: data,
      });

      if (!topic) {
        throw new Error("The file could not be saved to the local library.");
      }

      this.renderLibraryTopicList();
      this.renderTopicTreeIfReady();

      if (context.autoLaunch && context.launchGameId) {
        this.selectedLang = topic.lang;
        this.selectedGame = context.launchGameId;
        this.selectedTopic = {
          ...topic,
          localId: topic.id,
        };
        this.dom.languageSelect.value = topic.lang;
        this.dom.gameButtons.forEach((button) => {
          button.classList.toggle("is-selected", button.dataset.game === context.launchGameId);
        });
        this.renderTopicTree();
        await this.launchGameWithData(context.launchGameId, topic, topic.rows);
        return;
      }

      this.editingTopicId = topic.id;
      this.showLibraryEditor(topic.id);
    } catch (error) {
      Modal.error(`Could not import the file: ${error.message}`);
    }
  }

  renderTopicTreeIfReady() {
    if (this.selectedLang && this.selectedGame) {
      this.renderTopicTree();
    }
  }

  showLibrary() {
    this.destroyActiveGame();
    if (!this.dom.libraryLangSelect.value && this.selectedLang) {
      this.dom.libraryLangSelect.value = this.selectedLang;
    }
    this.populateLibraryTopicOptions();
    this.renderLibraryTopicList();
    this.router.navigate("library");
  }

  renderLibraryTopicList() {
    this.populateLibraryTopicOptions();
    const lang = this.dom.libraryLangSelect.value || null;
    const rawTopicFilter = normalizeWhitespace(this.dom.libraryTopicInput.value);
    const topicName = rawTopicFilter ? HubAdapter.normalizeTopicName(rawTopicFilter) : null;
    const languages = lang ? [lang] : HubAdapter.getLanguages().map((language) => language.id);
    const seen = new Set();
    const topics = languages
      .flatMap((languageId) =>
        flattenTopicTree(
          HubAdapter.buildTree(languageId, {
            topicName,
          }),
        ),
      )
      .filter((topic) => {
        const key = topic.originPath || topic.path || topic.id;
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    renderLibraryTopics(this.dom.libraryTopicsMount, {
      topics,
      onManage: (topicMeta) => this.manageLibraryTopic(topicMeta),
      onStart: (topicMeta, gameId) => this.startLibraryTopic(topicMeta, gameId),
    });
  }

  createLibraryTopic() {
    const lang = this.dom.libraryLangSelect.value;
    const rawTopicName = normalizeWhitespace(this.dom.libraryTopicInput.value);
    const name = normalizeWhitespace(this.dom.libraryTopicNameInput.value);

    if (!lang) {
      Modal.alert("Choose a language pair before creating a local list.");
      return;
    }

    if (!rawTopicName) {
      Modal.alert("Type a topic before creating a local list.");
      return;
    }

    if (!name) {
      Modal.alert("Type a name for the new local list.");
      return;
    }

    const topicName = HubAdapter.normalizeTopicName(rawTopicName);
    const category = getCategoryForTopic(topicName);
    const allowedGames = getAllowedGamesForTopic(topicName);

    if (Storage.topicTitleExists(name, { lang, category, topicName })) {
      Modal.alert("A local list with this name already exists for that language and type.");
      return;
    }

    const topic = Storage.createLibraryTopic({
      name,
      lang,
      topicName,
      source: "local",
      category,
      allowedGames,
      rows: [],
    });

    if (!topic) {
      Modal.error("The list could not be created.");
      return;
    }

    this.dom.libraryTopicNameInput.value = "";
    this.renderLibraryTopicList();
    this.renderTopicTreeIfReady();
    this.showLibraryEditor(topic.id);
  }

  showLibraryEditor(topicId) {
    this.editingTopicId = topicId;
    const topic = this.getEditingTopic();
    if (topic) {
      this.dom.libraryLangSelect.value = topic.lang || "";
      this.populateLibraryTopicOptions();
      this.dom.libraryTopicInput.value = topic.topicName || "grammer";
    }
    this.dom.librarySearchInput.value = "";
    this.renderLibraryEditor();
    this.router.navigate("libraryEditor");
  }

  getEditingTopic() {
    return this.editingTopicId ? Storage.getLibraryTopic(this.editingTopicId) : null;
  }

  renderLibraryEditor() {
    const topic = this.getEditingTopic();

    if (!topic) {
      this.showLibrary();
      return;
    }

    this.dom.libraryEditorTitle.textContent = topic.name;
    this.dom.libraryEditorMeta.textContent = `${topic.lang} | ${topic.topicName} | ${topic.rows.length} rows | ${getLibrarySourceLabel(topic)}`;

    const query = normalizeWhitespace(this.dom.librarySearchInput.value).toLowerCase();
    const rows = topic.rows.filter((row) => {
      if (!query) {
        return true;
      }

      return (
        row.source.toLowerCase().includes(query) || row.target.toLowerCase().includes(query)
      );
    });

    renderLibraryRows(this.dom.libraryRowsMount, {
      rows,
      onEdit: (rowId) => this.editLibraryRow(rowId),
      onDelete: (rowId) => this.deleteLibraryRow(rowId),
    });
  }

  addLibraryRow() {
    const topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    const sourceLabel =
      topic.category === "sentences" ? "Source sentence" : "Learning language";
    const targetLabel = topic.category === "sentences" ? "Translation" : "Translation";
    const source = window.prompt(sourceLabel, "");
    if (source === null) {
      return;
    }

    const target = window.prompt(targetLabel, "");
    if (target === null) {
      return;
    }

    const updated = Storage.addLibraryRow(topic.id, {
      source,
      target,
    });

    if (!updated) {
      Modal.alert("Both sides of the row are required.");
      return;
    }

    this.renderLibraryTopicList();
    this.renderLibraryEditor();
    this.renderTopicTreeIfReady();
  }

  editLibraryRow(rowId) {
    const topic = this.getEditingTopic();
    const row = topic?.rows.find((entry) => entry.id === rowId);

    if (!topic || !row) {
      return;
    }

    const source = window.prompt("Edit source text", row.source);
    if (source === null) {
      return;
    }

    const target = window.prompt("Edit translation", row.target);
    if (target === null) {
      return;
    }

    const updated = Storage.updateLibraryRow(topic.id, rowId, {
      source,
      target,
    });

    if (!updated) {
      Modal.alert("Both sides of the row are required.");
      return;
    }

    this.renderLibraryTopicList();
    this.renderLibraryEditor();
    this.renderTopicTreeIfReady();
  }

  async deleteLibraryRow(rowId) {
    const topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    const updatedTopic = Storage.removeLibraryRow(topic.id, rowId);

    if (!updatedTopic) {
      if (this.selectedTopic?.id === topic.id) {
        this.selectedTopic = null;
        this.dom.startButton.disabled = true;
        this.dom.startButton.textContent = "Select a topic first";
      }

      this.editingTopicId = null;
      this.renderLibraryTopicList();
      this.renderTopicTreeIfReady();
      this.showLibrary();
      return;
    }

    this.renderLibraryTopicList();
    this.renderLibraryEditor();
    this.renderTopicTreeIfReady();
  }

  renameLibraryTopic() {
    const topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    const nextName = window.prompt("New topic name:", topic.name);
    if (nextName === null) {
      return;
    }

    const cleanName = normalizeWhitespace(nextName);
    if (!cleanName) {
      return;
    }

    if (Storage.topicTitleExists(cleanName, {
      lang: topic.lang,
      category: topic.category,
      topicName: topic.topicName,
      excludeId: topic.id,
    })) {
      Modal.alert("A local list with this name already exists.");
      return;
    }

    Storage.renameLibraryTopic(topic.id, cleanName);
    this.renderLibraryTopicList();
    this.renderLibraryEditor();
    this.renderTopicTreeIfReady();

    if (this.selectedTopic?.id === topic.id) {
      this.selectedTopic = Storage.getLibraryTopic(topic.id);
    }
  }

  exportLibraryTopic() {
    const topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    const blob = createCsvBlob(topic.rows);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = topic.fileName || `${topic.name}.csv`;
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(link.href);
    }, 0);
  }

  async deleteLibraryTopic() {
    const topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    const confirmed = await Modal.confirm("Delete this local list and all of its rows?");
    if (!confirmed) {
      return;
    }

    Storage.removeLibraryTopic(topic.id);

    if (this.selectedTopic?.id === topic.id) {
      this.selectedTopic = null;
      this.dom.startButton.disabled = true;
      this.dom.startButton.textContent = "Select a topic first";
    }

    this.editingTopicId = null;
    this.renderLibraryTopicList();
    this.renderTopicTreeIfReady();
    this.showLibrary();
  }

  async manageLibraryTopic(topicMeta) {
    if (topicMeta.source === "hub") {
      try {
        const rows = await HubAdapter.loadTopic(topicMeta);
        const localTopic = HubAdapter.ensureLocalTopic(topicMeta, rows, {
          category: topicMeta.category,
          allowedGames: topicMeta.allowedGames,
        });
        this.renderLibraryTopicList();
        this.renderTopicTreeIfReady();
        this.showLibraryEditor(localTopic.id);
      } catch (error) {
        Modal.error(`Could not open the hub list: ${error.message}`);
      }
      return;
    }

    this.showLibraryEditor(topicMeta.id);
  }

  async startLibraryTopic(topicMeta, gameId) {
    const topic =
      topicMeta.source === "hub"
        ? topicMeta
        : Storage.getLibraryTopic(topicMeta.id);

    if (!topic) {
      Modal.alert("The selected topic could not be found.");
      this.renderLibraryTopicList();
      return;
    }

    this.selectedLang = topic.lang;
    this.selectedGame = gameId;
    this.selectedTopic = {
      ...topic,
      localId: topic.source === "hub" ? null : topic.id,
    };
    this.dom.languageSelect.value = topic.lang;
    this.dom.gameButtons.forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.game === gameId);
    });
    this.renderTopicTree();

    try {
      await this.launchGame(gameId, this.selectedTopic);
    } catch (error) {
      Modal.error(`Could not start the session: ${error.message}`);
    }
  }

  async restartTopic() {
    if (!this.selectedGame || !this.selectedTopic) {
      this.showHome();
      return;
    }

    try {
      await this.launchGame(this.selectedGame, this.selectedTopic);
    } catch (error) {
      Modal.error(`Could not restart the session: ${error.message}`);
      this.showHome();
    }
  }

  showHome() {
    this.destroyActiveGame();
    this.router.navigate("home", { record: false });

    if (this.selectedLang) {
      this.dom.languageSelect.value = this.selectedLang;
    }

    this.dom.gameButtons.forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.game === this.selectedGame);
    });

    if (this.selectedLang && this.selectedGame) {
      this.renderTopicTree();
    }

    this.dom.startButton.disabled = !this.selectedTopic;
    this.dom.startButton.textContent = this.selectedTopic
      ? `Start ${getGameLabel(this.selectedGame)}`
      : "Select a topic first";
  }

  showStats() {
    this.destroyActiveGame();
    renderStats(this.dom.statsMount, {
      sessions: Storage.getAllSessions(),
      hardItems: Storage.getAllHardItems(),
      fileCount: HubAdapter.countFiles(),
      languageCount: HubAdapter.getLanguages().length,
      storageUsage: Storage.getUsage(),
    });
    this.router.navigate("stats");
  }

  showContact() {
    this.destroyActiveGame();
    this.router.navigate("contact");
  }

  destroyActiveGame() {
    if (!this.activeGame) {
      return;
    }

    this.activeGame.destroy();
    this.activeGame = null;
    this.dom.gameMount.innerHTML = "";
  }

  registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed", error);
      });
    });
  }
}

function boot() {
  const app = new HubManager();
  app.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
