import { Storage } from "./storage.js";
import { parseCsv } from "../utils/csv.js";
import { normalizeWhitespace } from "../utils/text.js";

const ROOT_TITLE = "Choose a topic";
const DEFAULT_LOCAL_TOPIC = "grammer";
const SENTENCE_TOPIC = "sentences";
const DEFAULT_TOPICS = ["vocabulary", "grammer", "misc", "daily", "kitchen", "sentences"];
const STANDARD_GAMES = ["flashcards", "wordmatch"];
const SENTENCE_GAMES = ["flashcards", "wordmatch", "wordpuzzle"];

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    dispose() {
      window.clearTimeout(timerId);
    },
  };
}

function ensureRootTopic(tree, rootTitle, topicName) {
  if (!tree[rootTitle]) {
    tree[rootTitle] = {};
  }

  if (!tree[rootTitle][topicName]) {
    tree[rootTitle][topicName] = [];
  }
}

function normalizeTopicName(topicName, fallback = DEFAULT_LOCAL_TOPIC) {
  const normalized = normalizeWhitespace(String(topicName || ""))
    .replace(/_/g, " ")
    .toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized === "grammar" || normalized === "my library") {
    return DEFAULT_LOCAL_TOPIC;
  }

  if (normalized === "daily use") {
    return "daily";
  }

  if (normalized === "important words") {
    return "misc";
  }

  return normalized;
}

function resolveTopicName(record = {}) {
  if (record.topicName || record.topic) {
    return normalizeTopicName(record.topicName || record.topic);
  }

  const normalizedGroup = normalizeTopicName(record.group, "");
  const normalizedBranch = normalizeTopicName(record.branch, "");

  if (normalizedGroup === SENTENCE_TOPIC) {
    return SENTENCE_TOPIC;
  }

  if (normalizedGroup === "daily") {
    return "daily";
  }

  if (normalizedGroup === "misc") {
    return "misc";
  }

  if (normalizedGroup) {
    return normalizedGroup;
  }

  if (normalizedBranch) {
    return normalizedBranch;
  }

  return DEFAULT_LOCAL_TOPIC;
}

function inferCategory(topicName, record = {}) {
  if (record.category === SENTENCE_TOPIC) {
    return SENTENCE_TOPIC;
  }

  if (
    Array.isArray(record.allowedGames) &&
    record.allowedGames.includes("wordpuzzle")
  ) {
    return SENTENCE_TOPIC;
  }

  return normalizeTopicName(topicName) === SENTENCE_TOPIC ? SENTENCE_TOPIC : "vocabulary";
}

function inferAllowedGames(category, record = {}) {
  if (Array.isArray(record.allowedGames) && record.allowedGames.length > 0) {
    if (category === SENTENCE_TOPIC) {
      return [...new Set([...record.allowedGames, ...SENTENCE_GAMES])];
    }

    return [...new Set(record.allowedGames.filter((gameId) => gameId !== "wordpuzzle"))];
  }

  return category === SENTENCE_TOPIC ? [...SENTENCE_GAMES] : [...STANDARD_GAMES];
}

export const HubAdapter = {
  index: null,

  init() {
    const index = window.HUB_INDEX;

    if (!index || !Array.isArray(index.languages) || !Array.isArray(index.entries)) {
      throw new Error("HUB_INDEX is missing or invalid");
    }

    this.index = index;
  },

  getRootTitle() {
    return this.index?.rootTitle || ROOT_TITLE;
  },

  normalizeTopicName(topicName, fallback = DEFAULT_LOCAL_TOPIC) {
    return normalizeTopicName(topicName, fallback);
  },

  inferCategory(topicName, record = {}) {
    return inferCategory(topicName, record);
  },

  getAllowedGamesForTopic(topicName, record = {}) {
    return inferAllowedGames(inferCategory(topicName, record), record);
  },

  getLanguages() {
    return this.index?.languages || [];
  },

  getTopicSuggestions() {
    const topics = new Map();
    const addTopic = (topicName) => {
      const normalized = normalizeTopicName(topicName, "");
      if (!normalized || topics.has(normalized)) {
        return;
      }

      topics.set(normalized, normalized);
    };

    DEFAULT_TOPICS.forEach(addTopic);
    (this.index?.topics || []).forEach((topic) => addTopic(topic.id || topic.title));
    (this.index?.entries || []).forEach((entry) => addTopic(entry.topic));
    Storage.getLibraryTopics().forEach((topic) => addTopic(topic.topicName));

    return [...topics.values()];
  },

  getHardListTopics(lang) {
    const topics = [];
    const hardWordRows = Storage.getHardListRows(lang, "vocabulary");
    const hardSentenceRows = Storage.getHardListRows(lang, SENTENCE_TOPIC);

    if (hardWordRows.length > 0) {
      topics.push({
        id: `virtual:hard:words:${lang}`,
        name: "Hard words",
        file: "Hard words",
        path: `virtual:hard:words:${lang}`,
        lang,
        topicName: "hard",
        source: "hard-list",
        category: "vocabulary",
        allowedGames: [...STANDARD_GAMES],
        rowsCount: hardWordRows.length,
      });
    }

    if (hardSentenceRows.length > 0) {
      topics.push({
        id: `virtual:hard:sentences:${lang}`,
        name: "Hard sentences",
        file: "Hard sentences",
        path: `virtual:hard:sentences:${lang}`,
        lang,
        topicName: "hard",
        source: "hard-list",
        category: SENTENCE_TOPIC,
        allowedGames: [...SENTENCE_GAMES],
        rowsCount: hardSentenceRows.length,
      });
    }

    return topics;
  },

  buildTree(lang, options = {}) {
    const {
      gameId = null,
      topicName = null,
      preferManagedCopies = true,
      includeManagedHubCopies = true,
      sourceScope = "all",
      includeGeneratedHardLists = false,
    } = options;
    const tree = {};
    const rootTitle = this.getRootTitle();
    const normalizedTopicFilter = normalizeTopicName(topicName, "");

    if (sourceScope !== "hub") {
      Storage.getLibraryTopics().forEach((topic) => {
        if (topic.lang !== lang) {
          return;
        }

        if (sourceScope === "local" && topic.source === "hub-cache") {
          return;
        }

        const normalizedTopicName = resolveTopicName(topic);
        const category = inferCategory(normalizedTopicName, topic);
        const allowedGames = inferAllowedGames(category, topic);

        if (normalizedTopicFilter && normalizedTopicName !== normalizedTopicFilter) {
          return;
        }

        if (gameId && !allowedGames.includes(gameId)) {
          return;
        }

        if (topic.source === "hub-copy" && !includeManagedHubCopies) {
          return;
        }

        ensureRootTopic(tree, rootTitle, normalizedTopicName);
        tree[rootTitle][normalizedTopicName].push({
          id: topic.id,
          name: topic.name,
          file: topic.fileName || topic.name,
          path: topic.path,
          lang: topic.lang,
          topicName: normalizedTopicName,
          source: topic.source || "local",
          category,
          allowedGames,
          originPath: topic.originPath || null,
          localId: topic.id,
          rowsCount: topic.rows.length,
        });
      });

      if (includeGeneratedHardLists) {
        this.getHardListTopics(lang).forEach((topic) => {
          const normalizedTopicName = resolveTopicName(topic);
          const category = inferCategory(normalizedTopicName, topic);
          const allowedGames = inferAllowedGames(category, topic);

          if (normalizedTopicFilter && normalizedTopicName !== normalizedTopicFilter) {
            return;
          }

          if (gameId && !allowedGames.includes(gameId)) {
            return;
          }

          ensureRootTopic(tree, rootTitle, normalizedTopicName);
          tree[rootTitle][normalizedTopicName].push({
            ...topic,
            category,
            allowedGames,
          });
        });
      }
    }

    if (sourceScope !== "local") {
      (this.index?.entries || []).forEach((entry) => {
        const normalizedTopicName = resolveTopicName(entry);
        const category = inferCategory(normalizedTopicName, entry);
        const allowedGames = inferAllowedGames(category, entry);

        if (normalizedTopicFilter && normalizedTopicName !== normalizedTopicFilter) {
          return;
        }

        if (gameId && !allowedGames.includes(gameId)) {
          return;
        }

        const files = entry.files?.[lang];
        if (!files || files.length === 0) {
          return;
        }

        ensureRootTopic(tree, rootTitle, normalizedTopicName);

        files.forEach((fileName) => {
          const path = `hub/${lang}/${entry.folder}/${fileName}`;

          if (preferManagedCopies && Storage.findLibraryTopicByOrigin(path)) {
            return;
          }

          tree[rootTitle][normalizedTopicName].push({
            id: path,
            name: fileName.replace(/\.csv$/i, ""),
            file: fileName,
            path,
            lang,
            topicName: normalizedTopicName,
            source: "hub",
            category,
            allowedGames,
            folder: entry.folder,
          });
        });
      });
    }

    return tree;
  },

  async loadTopic(fileRecord, options = {}) {
    const record = typeof fileRecord === "string" ? { path: fileRecord } : fileRecord;
    const localId = record.localId || record.id;

    if (record.source === "hard-list") {
      return Storage.getHardListRows(record.lang, record.category);
    }

    if (
      localId &&
      (record.source !== "hub" ||
        String(record.path || "").startsWith("library:") ||
        String(localId).startsWith("library:"))
    ) {
      const localTopic = Storage.getLibraryTopic(localId);
      if (!localTopic) {
        throw new Error("Local topic not found in the library.");
      }

      return localTopic.rows || [];
    }

    const path = record.path;
    const requestPath = encodeURI(path);
    const timeoutHandle = options.signal ? null : createTimeoutSignal(15000);
    const signal = options.signal || timeoutHandle.signal;

    try {
      const response = await fetch(requestPath, { signal, cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Could not load ${path}`);
      }

      const text = await response.text();
      return parseCsv(text, path);
    } finally {
      timeoutHandle?.dispose();
    }
  },

  ensureLocalTopic(topicMeta, rows, options = {}) {
    const existingByOrigin =
      topicMeta.originPath || topicMeta.path
        ? Storage.findLibraryTopicByOrigin(topicMeta.originPath || topicMeta.path)
        : null;

    if (existingByOrigin) {
      return existingByOrigin;
    }

    const topicName = resolveTopicName(topicMeta);
    const category = options.category || inferCategory(topicName, topicMeta);
    const allowedGames = options.allowedGames || inferAllowedGames(category, topicMeta);
    const source = options.source || (topicMeta.source === "hub" ? "hub-copy" : topicMeta.source || "local");

    const nextTopic = Storage.createLibraryTopic({
      name: topicMeta.name,
      fileName: topicMeta.file || topicMeta.fileName || `${topicMeta.name}.csv`,
      lang: topicMeta.lang,
      topicName,
      source,
      category,
      allowedGames,
      rows,
      originPath: topicMeta.originPath || topicMeta.path || null,
      originMeta: {
        topic: topicName,
        folder: topicMeta.folder || null,
        file: topicMeta.file || topicMeta.fileName || null,
      },
    });

    return nextTopic;
  },

  countFiles(lang = null) {
    const languages = lang ? [lang] : this.getLanguages().map((language) => language.id);
    const seen = new Set();

    languages.forEach((languageId) => {
      const tree = this.buildTree(languageId);

      Object.values(tree).forEach((topics) => {
        Object.values(topics).forEach((files) => {
          files.forEach((fileMeta) => {
            const key = fileMeta.originPath || fileMeta.path || fileMeta.id;
            seen.add(key);
          });
        });
      });
    });

    return seen.size;
  },
};
