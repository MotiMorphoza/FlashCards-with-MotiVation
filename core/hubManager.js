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
const LOCAL_LISTS_TITLE = "My lists";

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
      libraryEditorMeta: document.getElementById("libraryEditorMeta"),
      addLibraryRowButton: document.getElementById("addLibraryRowButton"),
      exportLibraryTopicButton: document.getElementById("exportLibraryTopicButton"),
      renameLibraryTopicButton: document.getElementById("renameLibraryTopicButton"),
      librarySearchInput: document.getElementById("librarySearchInput"),
      libraryRowsMount: document.getElementById("libraryRowsMount"),
      backFromLibraryEditorTopButton: document.getElementById("backFromLibraryEditorTopButton"),
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

    this.dom.backFromLibraryEditorTopButton.addEventListener("click", () => {
      this.showLibrary();
    });

    this.dom.backFromLibraryEditorButton.addEventListener("click", () => {
      this.showLibrary();
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
    placeholder.textContent = "Choose a language pair";
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

  getSelectedLibraryTopicName() {
    const rawTopic = normalizeWhitespace(this.dom.libraryTopicInput.value);
    return rawTopic ? HubAdapter.normalizeTopicName(rawTopic) : "";
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

    const hubTree = HubAdapter.buildTree(this.selectedLang, {
      gameId: this.selectedGame,
      preferManagedCopies: false,
      includeManagedHubCopies: false,
      sourceScope: "hub",
    });
    const localTree = HubAdapter.buildTree(this.selectedLang, {
      gameId: this.selectedGame,
      sourceScope: "local",
    });
    const tree = {};

    if (hubTree[HubAdapter.getRootTitle()]) {
      tree[HubAdapter.getRootTitle()] = hubTree[HubAdapter.getRootTitle()];
    }

    if (localTree[HubAdapter.getRootTitle()]) {
      tree[LOCAL_LISTS_TITLE] = localTree[HubAdapter.getRootTitle()];
    }

    const availableTopics = flattenTopicTree(tree);
    const selectedStillVisible =
      this.selectedTopic &&
      availableTopics.some((topic) => {
        if (this.selectedTopic.source === "hub" && topic.source === "hub") {
          return topic.path === this.selectedTopic.path;
        }

        return topic.id === this.selectedTopic.id;
      });

    if (!selectedStillVisible) {
      this.selectedTopic = null;
      this.dom.startButton.disabled = true;
      this.dom.startButton.textContent = "Select a topic first";
    }

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
    if (topicMeta.source === "hub") {
      const rows = await HubAdapter.loadTopic(topicMeta);
      HubAdapter.ensureLocalTopic(topicMeta, rows, {
        category: topicMeta.category,
        allowedGames: topicMeta.allowedGames,
        source: "hub-cache",
      });
      this.renderLibraryTopicList();

      return {
        topicMeta,
        data: rows,
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
    const topicName = this.getSelectedLibraryTopicName();

    if (!lang) {
      Modal.alert("Choose a language pair for the local library import.");
      return;
    }

    if (!topicName) {
      Modal.alert("Type or choose a topic for the library import.");
      return;
    }
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

  showLibrary(options = {}) {
    this.destroyActiveGame();
    this.populateLibraryTopicOptions();
    this.renderLibraryTopicList();
    this.router.navigate("library");
  }

  renderLibraryTopicList() {
    this.populateLibraryTopicOptions();
    const languages = HubAdapter.getLanguages().map((language) => language.id);
    const seen = new Set();
    const topics = languages
      .flatMap((languageId) =>
        flattenTopicTree(
          HubAdapter.buildTree(languageId, {
          }),
        ),
      )
      .filter((topic) => {
        if (topic.source === "hub" && Storage.isLibraryOriginHidden(topic.path)) {
          return false;
        }

        const key = topic.originPath || topic.path || topic.id;
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const left = `${a.lang}|${a.topicName}|${a.name}`.toLowerCase();
        const right = `${b.lang}|${b.topicName}|${b.name}`.toLowerCase();
        return left.localeCompare(right);
      });

    renderLibraryTopics(this.dom.libraryTopicsMount, {
      topics,
      onEdit: (topicMeta) => this.manageLibraryTopic(topicMeta),
      onDelete: (topicMeta) => this.deleteTopicFromLibrary(topicMeta),
      onStart: (topicMeta, gameId) => this.startLibraryTopic(topicMeta, gameId),
    });
  }

  createLibraryTopic() {
    const lang = this.dom.libraryLangSelect.value;
    const topicName = this.getSelectedLibraryTopicName();
    const name = normalizeWhitespace(this.dom.libraryTopicNameInput.value);

    if (!lang) {
      Modal.alert("Choose a language pair before creating a local list.");
      return;
    }

    if (!topicName) {
      Modal.alert("Type a topic before creating a local list.");
      return;
    }

    if (!name) {
      Modal.alert("Type a name for the new local list.");
      return;
    }

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
    this.dom.librarySearchInput.value = "";
    this.renderLibraryEditor();
    this.router.navigate("libraryEditor");
  }

  getEditingTopic() {
    return this.editingTopicId ? Storage.getLibraryTopic(this.editingTopicId) : null;
  }

  ensureMineTopic(topic) {
    if (!topic || topic.source !== "hub-cache") {
      return topic;
    }

    const promoted = Storage.saveLibraryTopic({
      ...topic,
      source: "hub-copy",
    }, topic.rows);

    return promoted ? Storage.getLibraryTopic(topic.id) : topic;
  }

  renderLibraryEditor() {
    const topic = this.getEditingTopic();

    if (!topic) {
      this.showLibrary();
      return;
    }

    this.dom.libraryEditorMeta.textContent = "";

    const lang = document.createElement("span");
    lang.textContent = topic.lang;

    const topicName = document.createElement("span");
    topicName.textContent = topic.topicName;

    const name = document.createElement("span");
    name.className = "library-topic-card__name";
    name.textContent = topic.name;

    this.dom.libraryEditorMeta.append(
      lang,
      document.createTextNode(" | "),
      topicName,
      document.createTextNode(" | "),
      name,
    );

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
    let topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    topic = this.ensureMineTopic(topic);

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
    let topic = this.getEditingTopic();
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

    topic = this.ensureMineTopic(topic);

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
    let topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    topic = this.ensureMineTopic(topic);

    const updatedTopic = Storage.removeLibraryRow(topic.id, rowId);

    if (!updatedTopic) {
      if (topic.originPath) {
        Storage.hideLibraryOrigin(topic.originPath);
      }

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
    let topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    const nextName = window.prompt("New list name:", topic.name);
    if (nextName === null) {
      return;
    }

    const cleanName = normalizeWhitespace(nextName);
    if (!cleanName) {
      return;
    }

    topic = this.ensureMineTopic(topic);

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

  async manageLibraryTopic(topicMeta) {
    if (topicMeta.source === "hub") {
      try {
        const rows = await HubAdapter.loadTopic(topicMeta);
        const localTopic = HubAdapter.ensureLocalTopic(topicMeta, rows, {
          category: topicMeta.category,
          allowedGames: topicMeta.allowedGames,
          source: "hub-cache",
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

  async deleteTopicFromLibrary(topicMeta) {
    if (!topicMeta) {
      return;
    }

    if (topicMeta.source === "hub") {
      const confirmed = await Modal.confirm(
        "Remove this hub list from the Library? It will remain available in Home.",
      );

      if (!confirmed) {
        return;
      }

      Storage.hideLibraryOrigin(topicMeta.path);
      this.renderLibraryTopicList();
      return;
    }

    const confirmed = await Modal.confirm("Delete this local list from the Library?");
    if (!confirmed) {
      return;
    }

    const removed = Storage.removeLibraryTopic(topicMeta.id);
    if (!removed) {
      Modal.error("The list could not be deleted.");
      return;
    }

    if (topicMeta.originPath) {
      Storage.hideLibraryOrigin(topicMeta.originPath);
    }

    if (this.editingTopicId === topicMeta.id) {
      this.editingTopicId = null;
    }

    if (this.selectedTopic?.id === topicMeta.id) {
      this.selectedTopic = null;
      this.dom.startButton.disabled = true;
      this.dom.startButton.textContent = "Select a topic first";
    }

    this.renderLibraryTopicList();
    this.renderTopicTreeIfReady();
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
