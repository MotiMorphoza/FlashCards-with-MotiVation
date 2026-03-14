import { Storage } from "./storage.js";
import { parseCsv } from "../utils/csv.js";

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

function ensureTreeBranch(tree, branchName, groupName) {
  if (!tree[branchName]) {
    tree[branchName] = {};
  }

  if (!tree[branchName][groupName]) {
    tree[branchName][groupName] = [];
  }
}

function inferCategory(entryGroup, topic = {}) {
  if (topic.category) {
    return topic.category;
  }

  return entryGroup === "sentences" ? "sentences" : "vocabulary";
}

function inferAllowedGames(category, topic = {}) {
  if (Array.isArray(topic.allowedGames) && topic.allowedGames.length > 0) {
    return topic.allowedGames;
  }

  return category === "sentences" ? ["wordpuzzle"] : ["flashcards", "wordmatch"];
}

export const HubAdapter = {
  index: null,

  init() {
    const index = window.HUB_INDEX;

    if (
      !index ||
      !Array.isArray(index.languages) ||
      !Array.isArray(index.branches) ||
      !Array.isArray(index.entries)
    ) {
      throw new Error("HUB_INDEX is missing or invalid");
    }

    this.index = index;
  },

  getLanguages() {
    return this.index?.languages || [];
  },

  getBranches() {
    return this.index?.branches || [];
  },

  buildTree(lang, category = null, options = {}) {
    const { gameId = null } = options;
    const tree = {};

    Storage.getLibraryTopics().forEach((topic) => {
      if (topic.lang !== lang) {
        return;
      }

      if (category && topic.category !== category) {
        return;
      }

      if (
        gameId &&
        Array.isArray(topic.allowedGames) &&
        topic.allowedGames.length > 0 &&
        !topic.allowedGames.includes(gameId)
      ) {
        return;
      }

      const branch = topic.branch || "my library";
      const group = topic.group || (topic.category === "sentences" ? "sentences" : "my files");

      ensureTreeBranch(tree, branch, group);
      tree[branch][group].push({
        id: topic.id,
        name: topic.name,
        file: topic.fileName || topic.name,
        path: topic.path,
        lang: topic.lang,
        branch,
        group,
        source: topic.source || "local",
        category: topic.category,
        allowedGames: topic.allowedGames,
        originPath: topic.originPath || null,
        localId: topic.id,
      });
    });

    (this.index?.entries || []).forEach((entry) => {
      if (category && entry.group !== category) {
        return;
      }

      const files = entry.files?.[lang];
      if (!files || files.length === 0) {
        return;
      }

      ensureTreeBranch(tree, entry.branch, entry.group);

      files.forEach((fileName) => {
        const path = `hub/${lang}/${entry.branch}/${entry.group}/${fileName}`;
        tree[entry.branch][entry.group].push({
          id: path,
          name: fileName.replace(/\.csv$/i, ""),
          file: fileName,
          path,
          lang,
          branch: entry.branch,
          group: entry.group,
          source: "hub",
          category: inferCategory(entry.group),
          allowedGames: inferAllowedGames(inferCategory(entry.group)),
        });
      });
    });

    return tree;
  },

  async loadTopic(fileRecord, options = {}) {
    const record = typeof fileRecord === "string" ? { path: fileRecord } : fileRecord;
    const localId = record.localId || record.id;

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

    const category = options.category || inferCategory(topicMeta.group, topicMeta);
    const allowedGames = options.allowedGames || inferAllowedGames(category, topicMeta);
    const nextTopic = Storage.createLibraryTopic({
      name: topicMeta.name,
      fileName: topicMeta.file || topicMeta.fileName || `${topicMeta.name}.csv`,
      lang: topicMeta.lang,
      branch: "my library",
      group: topicMeta.group || (category === "sentences" ? "sentences" : "my files"),
      source: topicMeta.source === "hub" ? "hub-copy" : topicMeta.source || "local",
      category,
      allowedGames,
      rows,
      originPath: topicMeta.originPath || topicMeta.path || null,
      originMeta: {
        branch: topicMeta.branch || null,
        group: topicMeta.group || null,
        file: topicMeta.file || topicMeta.fileName || null,
      },
    });

    return nextTopic;
  },

  countFiles(lang = null) {
    let count = 0;

    (this.index?.entries || []).forEach((entry) => {
      if (lang) {
        count += entry.files?.[lang]?.length || 0;
        return;
      }

      Object.values(entry.files || {}).forEach((files) => {
        count += files.length;
      });
    });

    Storage.getLibraryTopics().forEach((topic) => {
      if (!lang || topic.lang === lang) {
        count += 1;
      }
    });

    return count;
  },
};
