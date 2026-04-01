import { AudioEngine } from "./audio.js";
import { EventBus } from "./eventBus.js";
import { HubAdapter } from "./hubAdapter.js";
import {
  buildCustomPairRecord,
  getAvailableLanguagePairs,
  isCreateNewLanguagePairValue,
  resolveLanguageLabel,
} from "./languagePairs.js";
import { Router } from "./router.js";
import { SessionEngine } from "./engine.js";
import { SpeechEngine } from "./speech.js";
import { Storage } from "./storage.js";
import {
  SENTENCE_TOPIC_NAME,
  createWordPuzzleTemplateList,
  isSystemTemplateList,
} from "./systemTemplates.js";
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

  return new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

function createPathSeparator() {
  const separator = document.createElement("span");
  separator.className = "library-path__sep";
  separator.textContent = "|";
  return separator;
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

function populateSelectOptions(select, options, placeholderLabel, selectedValue = "") {
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = placeholderLabel;
  select.appendChild(placeholder);

  options.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.title;
    select.appendChild(option);
  });

  if (selectedValue && options.some((entry) => entry.id === selectedValue)) {
    select.value = selectedValue;
    return;
  }

  select.value = "";
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
    this.librarySearchTimer = null;
    this.forceCollapsedTopicTree = false;
    this.openTopicRoot = "";
    this.homeTopicLaunchInFlight = false;
  }

  init() {
    this.cacheDom();
    this.registerScreens();
    this.restorePreferences();
    const hiddenOriginMigration = Storage.migrateLegacyHiddenOrigins();
    if (hiddenOriginMigration.failed) {
      console.warn("Legacy hidden HUB origins could not be migrated.");
    }
    HubAdapter.init();
    this.populateLanguages();
    this.populateLibraryLanguages();
    this.populateLibraryTopicOptions();
    this.bindUi();
    this.bindAppEvents();
    this.router.navigate("home", { record: false });
    this.renderLibraryTopicList();
    this.registerServiceWorker();
    document.body.classList.remove("app-booting");
  }

  cacheDom() {
    this.dom = {
      home: document.getElementById("screen-home"),
      library: document.getElementById("screen-library"),
      libraryEditor: document.getElementById("screen-library-editor"),
      game: document.getElementById("screen-game"),
      stats: document.getElementById("screen-stats"),
      contact: document.getElementById("screen-contact"),
      topbarControls: document.getElementById("topbarControls"),
      openHomeTopButton: document.getElementById("openHomeTopButton"),
      languageSelect: document.getElementById("languageSelect"),
      gameButtons: [...document.querySelectorAll("[data-game]")],
      topicPanel: document.getElementById("topicPanel"),
      topicTree: document.getElementById("topicTree"),
      openLibraryButton: document.getElementById("openLibraryButton"),
      libraryLangSelect: document.getElementById("libraryLangSelect"),
      libraryCustomPairFields: document.getElementById("libraryCustomPairFields"),
      libraryCustomSourceLabelInput: document.getElementById("libraryCustomSourceLabelInput"),
      libraryCustomTargetLabelInput: document.getElementById("libraryCustomTargetLabelInput"),
      libraryTopicInput: document.getElementById("libraryTopicInput"),
      libraryTopicOptions: document.getElementById("libraryTopicOptions"),
      libraryTopicNameInput: document.getElementById("libraryTopicNameInput"),
      createLibraryTopicButton: document.getElementById("createLibraryTopicButton"),
      importLibraryFileButton: document.getElementById("importLibraryFileButton"),
      libraryTopicsMount: document.getElementById("libraryTopicsMount"),
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
      openContactButton: document.getElementById("openContactButton"),
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

    this.dom.libraryLangSelect.addEventListener("change", () => {
      this.handleLibraryLanguageChange();
    });

    this.dom.gameButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.handleGameSelection(button.dataset.game);
      });
    });

    this.dom.openHomeTopButton.addEventListener("click", () => {
      this.showHome();
    });

    this.dom.openLibraryButton.addEventListener("click", () => {
      this.showLibrary();
    });

    this.dom.createLibraryTopicButton.addEventListener("click", () => {
      this.createLibraryTopic();
    });

    this.dom.importLibraryFileButton.addEventListener("click", () => {
      this.triggerLibraryImport();
    });

    this.dom.backFromLibraryEditorTopButton.addEventListener("click", () => {
      this.showLibrary();
    });

    this.dom.backFromLibraryEditorButton.addEventListener("click", () => {
      this.showLibrary();
    });

    this.dom.librarySearchInput.addEventListener("input", () => {
      window.clearTimeout(this.librarySearchTimer);
      this.librarySearchTimer = window.setTimeout(() => {
        this.renderLibraryEditor();
      }, 120);
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

    this.dom.openContactButton.addEventListener("click", () => {
      this.showContact();
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

    EventBus.on("route:change", ({ name }) => {
      this.updateTopbarState(name);
    });
  }

  updateToggleLabels() {
    this.dom.toggleSound.textContent = AudioEngine.enabled ? "Sound on" : "Sound off";
    this.dom.toggleSpeech.textContent = SpeechEngine.enabled
      ? "Speech on"
      : "Speech off";
  }

  updateTopbarState(screenName = this.router.currentScreen) {
    const showHomeButton = screenName !== "home";
    const showAudioButtons = screenName === "game";
    this.dom.openHomeTopButton.hidden = !showHomeButton;
    this.dom.toggleSound.hidden = !showAudioButtons;
    this.dom.toggleSpeech.hidden = !showAudioButtons;
    this.dom.toggleSound.style.display = showAudioButtons ? "" : "none";
    this.dom.toggleSpeech.style.display = showAudioButtons ? "" : "none";
    this.dom.openHomeTopButton.style.display = showHomeButton ? "" : "none";
    this.dom.topbarControls.hidden = !showHomeButton && !showAudioButtons;
  }

  handleStorageFailure(message) {
    const error = Storage.consumeLastError();
    if (!error) {
      return false;
    }

    const detail = error?.message ? ` ${error.message}` : "";
    Modal.error(`${message}${detail}`);
    return true;
  }

  populateLanguages(selectedValue = this.selectedLang || this.dom.languageSelect.value) {
    populateSelectOptions(
      this.dom.languageSelect,
      getAvailableLanguagePairs(),
      "Select a language pair",
      selectedValue,
    );
  }

  populateLibraryLanguages(selectedValue = this.dom.libraryLangSelect.value) {
    populateSelectOptions(
      this.dom.libraryLangSelect,
      getAvailableLanguagePairs({ includeCreateOption: true }),
      "Choose a language pair",
      selectedValue,
    );
    this.updateCustomLanguagePairFields();
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

  updateCustomLanguagePairFields() {
    const showCustomPairFields = isCreateNewLanguagePairValue(this.dom.libraryLangSelect.value);
    this.dom.libraryCustomPairFields.hidden = !showCustomPairFields;
    this.dom.libraryCustomSourceLabelInput.disabled = !showCustomPairFields;
    this.dom.libraryCustomTargetLabelInput.disabled = !showCustomPairFields;
  }

  handleLibraryLanguageChange() {
    this.updateCustomLanguagePairFields();
  }

  setHomeTopicIdleState() {
    if (!this.dom.startButton) {
      return;
    }

    this.dom.startButton.disabled = true;
    this.dom.startButton.textContent = "Select a topic first";
  }

  setHomeTopicLoadingState() {
    if (!this.dom.startButton) {
      return;
    }

    this.dom.startButton.disabled = true;
    this.dom.startButton.textContent = "Loading...";
  }

  setHomeTopicReadyState() {
    if (!this.dom.startButton) {
      return;
    }

    this.dom.startButton.disabled = false;
    this.dom.startButton.textContent = `Start ${getGameLabel(this.selectedGame)}`;
  }

  handleLanguageChange(lang) {
    this.selectedLang = lang || null;
    this.selectedGame = null;
    this.selectedTopic = null;
    this.dom.topicPanel.hidden = true;
    this.setHomeTopicIdleState();
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
    this.openTopicRoot = "";
    this.forceCollapsedTopicTree = true;
    this.setHomeTopicIdleState();

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
      includeGeneratedHardLists: true,
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
      this.setHomeTopicIdleState();
    }

    this.dom.topicPanel.hidden = false;
    this.dom.topicTree.innerHTML = "";
    this.dom.topicTree.appendChild(
      renderAccordionTree(tree, {
        selectedId: this.selectedTopic?.id || null,
        openFirstRoot: false,
        openBranchName: this.openTopicRoot,
        onSelect: (fileMeta, branchName) => this.handleHomeTopicSelection(fileMeta, branchName),
      }),
    );
    this.forceCollapsedTopicTree = false;
  }

  async handleHomeTopicSelection(fileMeta, branchName) {
    if (!this.selectedGame || this.homeTopicLaunchInFlight) {
      return;
    }

    this.selectedTopic = fileMeta;
    this.openTopicRoot = branchName || "";
    this.homeTopicLaunchInFlight = true;
    this.setHomeTopicLoadingState();
    this.renderTopicTree();

    try {
      const result = await this.launchGame(this.selectedGame, fileMeta);
      if (result?.launched === false) {
        return;
      }
      this.setHomeTopicReadyState();
    } catch (error) {
      Modal.error(`Could not start the session: ${error.message}`);
      this.setHomeTopicReadyState();
      this.renderTopicTree();
    } finally {
      this.homeTopicLaunchInFlight = false;
    }
  }

  async startSelectedTopic() {
    if (!this.selectedGame || !this.selectedTopic) {
      Modal.alert("Select both a game and a topic.");
      return;
    }

    this.setHomeTopicLoadingState();

    try {
      const result = await this.launchGame(this.selectedGame, this.selectedTopic);
      if (result?.launched === false) {
        return;
      }
      this.setHomeTopicReadyState();
    } catch (error) {
      Modal.error(`Could not start the session: ${error.message}`);
      this.setHomeTopicReadyState();
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

  getCustomLanguagePairDraft() {
    return buildCustomPairRecord(
      this.dom.libraryCustomSourceLabelInput.value,
      this.dom.libraryCustomTargetLabelInput.value,
    );
  }

  rollbackCreatedLibraryArtifacts(topicIds = [], pairId = null) {
    [...topicIds].reverse().forEach((topicId) => {
      if (topicId) {
        Storage.removeLibraryTopic(topicId);
      }
    });

    if (pairId) {
      Storage.removeLocalLanguagePair(pairId);
    }
  }

  redirectSystemTemplateLaunch(topicMeta) {
    if (!topicMeta?.id) {
      return true;
    }

    this.selectedTopic = null;
    this.setHomeTopicIdleState();
    this.showLibraryEditor(topicMeta.id);
    return true;
  }

  async prepareTopicForLaunch(gameId, topicMeta) {
    if (topicMeta.source === "hub") {
      const rows = await HubAdapter.loadTopic(topicMeta);
      const cachedTopic = HubAdapter.ensureLocalTopic(topicMeta, rows, {
        category: topicMeta.category,
        allowedGames: topicMeta.allowedGames,
        source: "hub-cache",
      });
      if (!cachedTopic) {
        this.handleStorageFailure(
          "The session started, but the local cached copy could not be saved.",
        );
      }
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
    const latestTopic =
      topicMeta?.source && topicMeta.source !== "hub" && topicMeta.id
        ? Storage.getLibraryTopic(topicMeta.id) || topicMeta
        : topicMeta;

    if (isSystemTemplateList(latestTopic)) {
      this.redirectSystemTemplateLaunch(latestTopic);
      return { launched: false, redirected: true };
    }

    const prepared = await this.prepareTopicForLaunch(gameId, latestTopic);
    this.selectedTopic = prepared.topicMeta;

    if (this.selectedTopic.lang) {
      this.selectedLang = this.selectedTopic.lang;
      this.dom.languageSelect.value = this.selectedLang;
    }

    this.selectedGame = gameId;
    this.renderTopicTree();

    await this.launchGameWithData(gameId, prepared.topicMeta, prepared.data);
    return { launched: true, redirected: false };
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
      originPath: topicMeta.originPath || null,
      lang: topicMeta.lang,
      topicName: topicMeta.topicName,
      category: topicMeta.category,
      allowedGames: topicMeta.allowedGames,
      isSystemTemplate: topicMeta.isSystemTemplate === true,
      systemTemplateKind: topicMeta.systemTemplateKind || null,
    });

    this.activeGame = new GameModule();
    await this.activeGame.init(
      this.dom.gameMount,
      {
        lang: topicMeta.lang,
        languageLabel: resolveLanguageLabel(topicMeta.lang),
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

    if (isCreateNewLanguagePairValue(lang)) {
      Modal.alert("Create the new language pair through Create list before importing into it.");
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
        if (
          this.handleStorageFailure(
            "The file could not be saved to the local library.",
          )
        ) {
          return;
        }
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
    this.populateLibraryLanguages(this.dom.libraryLangSelect.value);
    this.populateLibraryTopicOptions();
    this.renderLibraryTopicList();
    this.router.navigate("library");
  }

  renderLibraryTopicList() {
    this.populateLibraryTopicOptions();
    const languages = getAvailableLanguagePairs().map((language) => language.id);
    const seen = new Set();
    const topics = languages
      .flatMap((languageId) =>
        flattenTopicTree(
          HubAdapter.buildTree(languageId, {
            sourceScope: "all",
          }),
        ),
      )
      .filter((topic) => {
        if (topic.source === "hub" || topic.source === "hard-list") {
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
        const left = `${resolveLanguageLabel(a.lang)}|${a.topicName}|${a.name}`.toLowerCase();
        const right = `${resolveLanguageLabel(b.lang)}|${b.topicName}|${b.name}`.toLowerCase();
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
    const selectedLanguage = this.dom.libraryLangSelect.value;
    const topicName = this.getSelectedLibraryTopicName();
    const name = normalizeWhitespace(this.dom.libraryTopicNameInput.value);

    if (!selectedLanguage) {
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

    let lang = selectedLanguage;
    let createdPair = null;
    const createdTopicIds = [];

    if (isCreateNewLanguagePairValue(selectedLanguage)) {
      const pairDraft = this.getCustomLanguagePairDraft();

      if (!pairDraft.sourceLabel || !pairDraft.targetLabel) {
        Modal.alert("Type both language labels before creating the new list.");
        return;
      }

      const existingPair = Storage.findLocalLanguagePairByLabels(
        pairDraft.sourceLabel,
        pairDraft.targetLabel,
      );
      if (existingPair) {
        Modal.alert("That custom language pair already exists. Choose it from the selector.");
        return;
      }

      createdPair = Storage.createLocalLanguagePair(pairDraft);
      if (!createdPair) {
        if (this.handleStorageFailure("The custom language pair could not be created.")) {
          return;
        }
        Modal.error("The custom language pair could not be created.");
        return;
      }

      lang = createdPair.id;
    }

    const category = getCategoryForTopic(topicName);
    const allowedGames = getAllowedGamesForTopic(topicName);

    if (Storage.topicTitleExists(name, { lang, category, topicName })) {
      if (createdPair) {
        this.rollbackCreatedLibraryArtifacts([], createdPair.id);
      }
      Modal.alert("A local list with this name already exists for that language and type.");
      return;
    }

    if (createdPair && topicName !== SENTENCE_TOPIC_NAME) {
      const templateTopic = Storage.createLibraryTopic(createWordPuzzleTemplateList(lang));
      if (!templateTopic) {
        this.rollbackCreatedLibraryArtifacts([], createdPair.id);
        if (this.handleStorageFailure("The required Word Puzzle setup list could not be created.")) {
          return;
        }
        Modal.error("The required Word Puzzle setup list could not be created.");
        return;
      }

      createdTopicIds.push(templateTopic.id);
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
      this.rollbackCreatedLibraryArtifacts(createdTopicIds, createdPair?.id || null);
      if (this.handleStorageFailure("The list could not be created.")) {
        return;
      }
      Modal.error("The list could not be created.");
      return;
    }

    this.dom.libraryTopicNameInput.value = "";
    this.dom.libraryCustomSourceLabelInput.value = "";
    this.dom.libraryCustomTargetLabelInput.value = "";
    this.selectedLang = lang;
    this.selectedTopic = null;
    this.populateLanguages(lang);
    this.dom.languageSelect.value = lang;
    this.populateLibraryLanguages(lang);
    this.renderLibraryTopicList();
    this.renderTopicTreeIfReady();
    this.showLibraryEditor(topic.id);
  }

  showLibraryEditor(topicId) {
    this.editingTopicId = topicId;
    window.clearTimeout(this.librarySearchTimer);
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
    this.dom.libraryEditorMeta.dir = "ltr";

    const lang = document.createElement("span");
    lang.className = "library-path__lang";
    lang.dir = "auto";
    lang.textContent = resolveLanguageLabel(topic.lang);

    const topicName = document.createElement("span");
    topicName.className = "library-path__topic";
    topicName.dir = "auto";
    topicName.textContent = topic.topicName;

    const name = document.createElement("span");
    name.className = "library-topic-card__name library-path__name";
    name.dir = "auto";
    name.textContent = topic.name;

    this.dom.libraryEditorMeta.append(
      lang,
      createPathSeparator(),
      topicName,
      createPathSeparator(),
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

  async addLibraryRow() {
    let topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    topic = this.ensureMineTopic(topic);

    const sourceLabel =
      topic.category === "sentences" ? "Source sentence" : "Learning language";
    const rowValues = await Modal.form({
      title: topic.category === "sentences" ? "Add sentence" : "Add row",
      message: "Add a new source and translation pair.",
      confirmLabel: "Save",
      fields: [
        {
          id: "source",
          label: sourceLabel,
          value: "",
          placeholder: sourceLabel,
        },
        {
          id: "target",
          label: "Translation",
          value: "",
          placeholder: "Translation",
        },
      ],
      validate: (values) => (
        !normalizeWhitespace(values.source) || !normalizeWhitespace(values.target)
          ? "Both sides of the row are required."
          : ""
      ),
    });

    if (!rowValues) {
      return;
    }

    const updated = Storage.addLibraryRow(topic.id, {
      source: rowValues.source,
      target: rowValues.target,
    });

    if (this.handleStorageFailure("The row could not be saved locally.")) {
      return;
    }

    if (!updated) {
      Modal.alert("Both sides of the row are required.");
      return;
    }

    this.renderLibraryTopicList();
    this.renderLibraryEditor();
    this.renderTopicTreeIfReady();
  }

  async editLibraryRow(rowId) {
    let topic = this.getEditingTopic();
    const row = topic?.rows.find((entry) => entry.id === rowId);

    if (!topic || !row) {
      return;
    }

    const rowValues = await Modal.form({
      title: "Edit row",
      message: "Update the source and translation text.",
      confirmLabel: "Save changes",
      fields: [
        {
          id: "source",
          label: "Source",
          value: row.source,
          placeholder: "Source",
        },
        {
          id: "target",
          label: "Translation",
          value: row.target,
          placeholder: "Translation",
        },
      ],
      validate: (values) => (
        !normalizeWhitespace(values.source) || !normalizeWhitespace(values.target)
          ? "Both sides of the row are required."
          : ""
      ),
    });

    if (!rowValues) {
      return;
    }

    topic = this.ensureMineTopic(topic);

    const updated = Storage.updateLibraryRow(topic.id, rowId, {
      source: rowValues.source,
      target: rowValues.target,
    });

    if (this.handleStorageFailure("The row changes could not be saved locally.")) {
      return;
    }

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

    if (this.handleStorageFailure("The row could not be deleted locally.")) {
      return;
    }

    if (!updatedTopic) {
      if (topic.originPath) {
        Storage.hideLibraryOrigin(topic.originPath);
      }

      if (this.selectedTopic?.id === topic.id) {
        this.selectedTopic = null;
        this.setHomeTopicIdleState();
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

  async renameLibraryTopic() {
    let topic = this.getEditingTopic();
    if (!topic) {
      return;
    }

    const nextName = await Modal.prompt("", topic.name, {
      title: "Rename list",
      label: "List name",
      confirmLabel: "Save",
      placeholder: "List name",
      validate: (values) => (
        !normalizeWhitespace(values.value) ? "List name is required." : ""
      ),
    });
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
    if (this.handleStorageFailure("The list rename could not be saved locally.")) {
      return;
    }
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
        if (!localTopic) {
          this.handleStorageFailure("The hub list could not be opened for local editing.");
          return;
        }
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
      this.setHomeTopicIdleState();
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
    const launchTopic = {
      ...topic,
      localId: topic.source === "hub" ? null : topic.id,
    };
    this.selectedTopic = launchTopic;
    this.dom.languageSelect.value = topic.lang;
    this.dom.gameButtons.forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.game === gameId);
    });
    this.renderTopicTree();

    try {
      const result = await this.launchGame(gameId, launchTopic);
      if (result?.launched === false) {
        return;
      }
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
      const result = await this.launchGame(this.selectedGame, this.selectedTopic);
      if (result?.launched === false) {
        return;
      }
    } catch (error) {
      Modal.error(`Could not restart the session: ${error.message}`);
      this.showHome();
    }
  }

  showHome() {
    this.destroyActiveGame();
    this.router.navigate("home", { record: false });
    this.forceCollapsedTopicTree = true;
    this.openTopicRoot = "";

    if (this.selectedLang) {
      this.dom.languageSelect.value = this.selectedLang;
    }

    this.dom.gameButtons.forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.game === this.selectedGame);
    });

    if (this.selectedLang && this.selectedGame) {
      this.renderTopicTree();
    }

    if (this.selectedTopic) {
      this.setHomeTopicReadyState();
    } else {
      this.setHomeTopicIdleState();
    }
  }

  showStats() {
    this.destroyActiveGame();
    const hardSummary = Storage.getHardListSummary();
    renderStats(this.dom.statsMount, {
      sessions: Storage.getAllSessions(),
      hardSummary,
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
      navigator.serviceWorker
        .register("./sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update().catch(() => {}))
        .catch((error) => {
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
