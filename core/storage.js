import { uid } from "../utils/helpers.js";
import { normalizeWhitespace } from "../utils/text.js";

const VERSION = "v4";
const PREFIX = "LLH";
const LIBRARY_KEY = `${PREFIX}_${VERSION}_library_topics_global`;

function keyPart(value) {
  return encodeURIComponent(value ?? "global");
}

function buildKey(type, game = "global", topicId = "global") {
  return `${PREFIX}_${VERSION}_${type}_${keyPart(game)}_${keyPart(topicId)}`;
}

function safeGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Storage write failed", error);
    return false;
  }
}

function inferCategory(category, allowedGames = []) {
  if (category === "sentences") {
    return "sentences";
  }

  return allowedGames.includes("wordpuzzle") && allowedGames.length === 1
    ? "sentences"
    : "vocabulary";
}

function inferAllowedGames(category, allowedGames = null) {
  if (Array.isArray(allowedGames) && allowedGames.length > 0) {
    return [...new Set(allowedGames)];
  }

  return category === "sentences" ? ["wordpuzzle"] : ["flashcards", "wordmatch"];
}

function sanitizeRow(row = {}, fallbackPrefix = "row") {
  const source = normalizeWhitespace(row.source ?? row.learn ?? "");
  const target = normalizeWhitespace(row.target ?? row.tr ?? "");

  if (!source || !target) {
    return null;
  }

  return {
    id: row.id || uid(fallbackPrefix),
    source,
    target,
  };
}

function sanitizeRows(rows = [], fallbackPrefix = "row") {
  return rows
    .map((row, index) => sanitizeRow(row, `${fallbackPrefix}-${index}`))
    .filter(Boolean);
}

function sanitizeTopic(topic = {}, existing = null) {
  const topicId = topic.id || existing?.id || `library:${uid("topic")}`;
  const category = inferCategory(topic.category, topic.allowedGames || existing?.allowedGames);
  const allowedGames = inferAllowedGames(category, topic.allowedGames || existing?.allowedGames);
  const rows = sanitizeRows(
    topic.rows ?? existing?.rows ?? [],
    topicId,
  );
  const name = normalizeWhitespace(topic.name ?? topic.title ?? existing?.name ?? "Untitled");
  const branch = topic.branch ?? existing?.branch ?? "my library";
  const group =
    topic.group ?? existing?.group ?? (category === "sentences" ? "sentences" : "my files");
  const source = topic.source ?? existing?.source ?? "local";
  const createdAt = existing?.createdAt ?? topic.createdAt ?? Date.now();
  const updatedAt = topic.updatedAt ?? existing?.updatedAt ?? Date.now();

  return {
    id: topicId,
    name,
    fileName: topic.fileName || existing?.fileName || `${name}.csv`,
    path: topic.path || existing?.path || topicId,
    lang: topic.lang || existing?.lang || "",
    branch,
    group,
    source,
    category,
    allowedGames,
    rows,
    createdAt,
    updatedAt,
    originPath: topic.originPath ?? existing?.originPath ?? null,
    originMeta: topic.originMeta ?? existing?.originMeta ?? null,
  };
}

function updateTopicInCollection(topicId, updater) {
  const topics = Storage.getLibraryTopics();
  const index = topics.findIndex((topic) => topic.id === topicId);

  if (index < 0) {
    return null;
  }

  const updated = updater(topics[index]);
  if (!updated) {
    return null;
  }

  topics[index] = sanitizeTopic(updated, topics[index]);
  safeSet(LIBRARY_KEY, topics);
  return topics[index];
}

export const Storage = {
  key(type, game, topicId) {
    return buildKey(type, game, topicId);
  },

  get(key, fallback = null) {
    return safeGet(key, fallback);
  },

  set(key, value) {
    return safeSet(key, value);
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  getPreference(name, fallback = null) {
    const preferences = safeGet(buildKey("preferences"), {});
    return Object.prototype.hasOwnProperty.call(preferences, name)
      ? preferences[name]
      : fallback;
  },

  setPreference(name, value) {
    const preferences = safeGet(buildKey("preferences"), {});
    preferences[name] = value;
    return safeSet(buildKey("preferences"), preferences);
  },

  getLibraryTopics() {
    return safeGet(LIBRARY_KEY, []).map((topic) => sanitizeTopic(topic));
  },

  getLibraryTopic(topicId) {
    return this.getLibraryTopics().find((topic) => topic.id === topicId) || null;
  },

  topicTitleExists(name, options = {}) {
    const normalized = normalizeWhitespace(name).toLowerCase();
    const { lang = null, category = null, excludeId = null } = options;

    return this.getLibraryTopics().some((topic) => {
      if (excludeId && topic.id === excludeId) {
        return false;
      }

      if (lang && topic.lang !== lang) {
        return false;
      }

      if (category && topic.category !== category) {
        return false;
      }

      return normalizeWhitespace(topic.name).toLowerCase() === normalized;
    });
  },

  saveLibraryTopic(topicMeta, rows = null) {
    const topics = this.getLibraryTopics();
    const existingIndex = topics.findIndex((topic) => topic.id === topicMeta.id);
    const existing = existingIndex >= 0 ? topics[existingIndex] : null;
    const nextTopic = sanitizeTopic(
      {
        ...existing,
        ...topicMeta,
        rows: rows ?? topicMeta.rows ?? existing?.rows ?? [],
        updatedAt: Date.now(),
      },
      existing,
    );

    if (existingIndex >= 0) {
      topics[existingIndex] = nextTopic;
    } else {
      topics.push(nextTopic);
    }

    return safeSet(LIBRARY_KEY, topics);
  },

  createLibraryTopic(topicMeta) {
    const nextTopic = sanitizeTopic(topicMeta);
    const saved = this.saveLibraryTopic(nextTopic, nextTopic.rows);
    return saved ? this.getLibraryTopic(nextTopic.id) : null;
  },

  renameLibraryTopic(topicId, name) {
    return updateTopicInCollection(topicId, (topic) => ({
      ...topic,
      name,
      fileName: `${normalizeWhitespace(name)}.csv`,
    }));
  },

  setLibraryTopicRows(topicId, rows) {
    return updateTopicInCollection(topicId, (topic) => ({
      ...topic,
      rows: sanitizeRows(rows, topicId),
    }));
  },

  addLibraryRow(topicId, row) {
    return updateTopicInCollection(topicId, (topic) => {
      const nextRow = sanitizeRow(row, `${topicId}-row`);
      if (!nextRow) {
        return null;
      }

      return {
        ...topic,
        rows: [...topic.rows, nextRow],
      };
    });
  },

  updateLibraryRow(topicId, rowId, changes) {
    return updateTopicInCollection(topicId, (topic) => ({
      ...topic,
      rows: topic.rows.map((row) =>
        row.id === rowId ? sanitizeRow({ ...row, ...changes }, `${topicId}-row`) : row,
      ),
    }));
  },

  removeLibraryRow(topicId, rowId) {
    return updateTopicInCollection(topicId, (topic) => ({
      ...topic,
      rows: topic.rows.filter((row) => row.id !== rowId),
    }));
  },

  removeLibraryTopic(topicId) {
    const topics = this.getLibraryTopics().filter((topic) => topic.id !== topicId);
    return safeSet(LIBRARY_KEY, topics);
  },

  findLibraryTopicByOrigin(originPath) {
    return (
      this.getLibraryTopics().find((topic) => topic.originPath && topic.originPath === originPath) ||
      null
    );
  },

  getImportedTopics() {
    return this.getLibraryTopics();
  },

  saveImportedTopic(topicMeta, rows) {
    return this.saveLibraryTopic(topicMeta, rows);
  },

  getImportedTopic(topicId) {
    return this.getLibraryTopic(topicId);
  },

  removeImportedTopic(topicId) {
    return this.removeLibraryTopic(topicId);
  },

  saveGameSession(game, topicMeta, stats) {
    const sessionKey = buildKey("sessions", game, topicMeta.id);
    const sessions = safeGet(sessionKey, []);

    sessions.push({
      date: Date.now(),
      topic: topicMeta.name,
      lang: topicMeta.lang,
      path: topicMeta.path,
      branch: topicMeta.branch,
      group: topicMeta.group,
      ...stats,
    });

    if (sessions.length > 100) {
      sessions.splice(0, sessions.length - 100);
    }

    safeSet(sessionKey, sessions);
    this.addGlobalSession(game, topicMeta, stats);
  },

  addGlobalSession(game, topicMeta, stats) {
    const globalKey = buildKey("sessions", "all");
    const sessions = safeGet(globalKey, []);

    sessions.push({
      date: Date.now(),
      game,
      topic: topicMeta.name,
      lang: topicMeta.lang,
      path: topicMeta.path,
      time: stats.time,
      correct: stats.correct,
      wrong: stats.wrong,
      attempts: stats.attempts,
      accuracy: stats.accuracy,
    });

    if (sessions.length > 500) {
      sessions.splice(0, sessions.length - 500);
    }

    safeSet(globalKey, sessions);
  },

  getGameSessions(game, topicId = null) {
    return safeGet(buildKey("sessions", game, topicId), []);
  },

  getAllSessions() {
    return safeGet(buildKey("sessions", "all"), []);
  },

  updateBestTime(game, topicId, time) {
    const key = buildKey("best", game, topicId);
    const current = safeGet(key, 0);

    if (!current || time < current) {
      safeSet(key, time);
      return true;
    }

    return false;
  },

  getBestTime(game, topicId) {
    return safeGet(buildKey("best", game, topicId), 0);
  },

  addHardItem(game, topicId, itemId) {
    const key = buildKey("hard", game, topicId);
    const items = safeGet(key, {});
    items[itemId] = (items[itemId] || 0) + 1;
    safeSet(key, items);
  },

  getHardItems(game, topicId) {
    return safeGet(buildKey("hard", game, topicId), {});
  },

  getAllHardItems() {
    const prefix = `${PREFIX}_${VERSION}_hard_`;
    const result = [];

    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(prefix)) {
        return;
      }

      const raw = safeGet(key, {});
      Object.entries(raw).forEach(([itemId, count]) => {
        result.push({ key, itemId, count });
      });
    });

    return result;
  },

  removeHardItem(game, topicId, itemId) {
    const key = buildKey("hard", game, topicId);
    const items = safeGet(key, {});
    delete items[itemId];
    safeSet(key, items);
  },

  clearNamespace(type = null) {
    const prefix = type ? `${PREFIX}_${VERSION}_${type}_` : `${PREFIX}_${VERSION}_`;

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  },

  getUsage() {
    let bytes = 0;

    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(`${PREFIX}_${VERSION}_`)) {
        return;
      }

      bytes += key.length;
      bytes += (localStorage.getItem(key) || "").length;
    });

    return {
      bytes,
      kb: (bytes / 1024).toFixed(2),
      mb: (bytes / 1024 / 1024).toFixed(2),
    };
  },
};
