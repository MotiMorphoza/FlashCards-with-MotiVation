import { uid } from "../utils/helpers.js";
import { normalizeWhitespace } from "../utils/text.js";

const VERSION = "v4";
const PREFIX = "LLH";
const LIBRARY_KEY = `${PREFIX}_${VERSION}_library_topics_global`;
const HIDDEN_ORIGINS_KEY = `${PREFIX}_${VERSION}_hidden_hub_origins`;
const HIDDEN_LIBRARY_HUB_ORIGINS_KEY = `${PREFIX}_${VERSION}_hidden_library_hub_origins`;
const LOCAL_TOPIC_NAME = "grammer";
const SENTENCE_TOPIC_NAME = "sentences";
const STANDARD_GAMES = ["flashcards", "wordmatch"];
const SENTENCE_GAMES = ["flashcards", "wordmatch", "wordpuzzle"];
let lastStorageError = null;

function keyPart(value) {
  return encodeURIComponent(value ?? "global");
}

function buildKey(type, game = "global", topicId = "global") {
  return `${PREFIX}_${VERSION}_${type}_${keyPart(game)}_${keyPart(topicId)}`;
}

function resolveTopicStorageCandidates(topicRef = null) {
  if (!topicRef || typeof topicRef === "undefined") {
    return ["global"];
  }

  if (typeof topicRef === "string") {
    return [topicRef || "global"];
  }

  const candidates = [
    topicRef.originPath,
    topicRef.path,
    topicRef.id,
  ]
    .map((value) => normalizeWhitespace(String(value || "")))
    .filter(Boolean);

  return candidates.length > 0 ? [...new Set(candidates)] : ["global"];
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
    lastStorageError = null;
    return true;
  } catch (error) {
    lastStorageError = error;
    console.error("Storage write failed", error);
    return false;
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
    lastStorageError = null;
    return true;
  } catch (error) {
    lastStorageError = error;
    console.error("Storage remove failed", error);
    return false;
  }
}

function getLegacyHiddenOrigins() {
  return safeGet(HIDDEN_ORIGINS_KEY, []);
}

function setLegacyHiddenOrigins(origins) {
  return safeSet(HIDDEN_ORIGINS_KEY, [...new Set(origins.filter(Boolean))]);
}

function getHiddenLibraryHubOrigins() {
  return safeGet(HIDDEN_LIBRARY_HUB_ORIGINS_KEY, []);
}

function setHiddenLibraryHubOrigins(origins) {
  return safeSet(HIDDEN_LIBRARY_HUB_ORIGINS_KEY, [...new Set(origins.filter(Boolean))]);
}

function buildHardItemSignature(topicMeta = {}, item = null) {
  if (!item || typeof item !== "object") {
    return typeof item === "string" ? item : "";
  }

  const lang = normalizeWhitespace(topicMeta.lang || "");
  const source = normalizeWhitespace(item.source ?? item.learn ?? "");
  const target = normalizeWhitespace(item.target ?? item.tr ?? "");
  const topicName = resolveTopicName(topicMeta, null);
  const category = inferCategory(
    topicName,
    topicMeta.category,
    topicMeta.allowedGames || [],
  );

  if (!lang || !source || !target) {
    return item.id || "";
  }

  return [
    "hard",
    encodeURIComponent(lang),
    encodeURIComponent(category),
    encodeURIComponent(source),
    encodeURIComponent(target),
  ].join("|");
}

function parseHardItemSignature(signature) {
  if (typeof signature !== "string" || !signature.startsWith("hard|")) {
    return null;
  }

  const parts = signature.split("|");
  if (parts.length !== 5) {
    return null;
  }

  try {
    return {
      lang: decodeURIComponent(parts[1]),
      category: decodeURIComponent(parts[2]),
      source: decodeURIComponent(parts[3]),
      target: decodeURIComponent(parts[4]),
    };
  } catch {
    return null;
  }
}

function normalizeTopicName(topicName, fallback = LOCAL_TOPIC_NAME) {
  const normalized = normalizeWhitespace(String(topicName || ""))
    .replace(/_/g, " ")
    .toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized === "grammar" || normalized === "my library") {
    return LOCAL_TOPIC_NAME;
  }

  if (normalized === "daily use") {
    return "daily";
  }

  if (normalized === "important words") {
    return "misc";
  }

  return normalized;
}

function resolveTopicName(record = {}, existing = null) {
  if (record.topicName || record.topic) {
    return normalizeTopicName(record.topicName || record.topic);
  }

  const normalizedGroup = normalizeTopicName(record.group ?? existing?.group, "");
  const normalizedBranch = normalizeTopicName(record.branch ?? existing?.branch, "");

  if (normalizedGroup === SENTENCE_TOPIC_NAME) {
    return SENTENCE_TOPIC_NAME;
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

  return normalizeTopicName(existing?.topicName);
}

function inferCategory(topicName, category, allowedGames = []) {
  if (category === SENTENCE_TOPIC_NAME) {
    return SENTENCE_TOPIC_NAME;
  }

  if (normalizeTopicName(topicName) === SENTENCE_TOPIC_NAME) {
    return SENTENCE_TOPIC_NAME;
  }

  return allowedGames.includes("wordpuzzle") ? SENTENCE_TOPIC_NAME : "vocabulary";
}

function inferAllowedGames(category, allowedGames = null) {
  if (Array.isArray(allowedGames) && allowedGames.length > 0) {
    if (category === SENTENCE_TOPIC_NAME) {
      return [...new Set([...allowedGames, ...SENTENCE_GAMES])];
    }

    return [...new Set(allowedGames.filter((gameId) => gameId !== "wordpuzzle"))];
  }

  return category === SENTENCE_TOPIC_NAME ? [...SENTENCE_GAMES] : [...STANDARD_GAMES];
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
  const topicName = resolveTopicName(topic, existing);
  const category = inferCategory(
    topicName,
    topic.category ?? existing?.category,
    topic.allowedGames || existing?.allowedGames || [],
  );
  const allowedGames = inferAllowedGames(category, topic.allowedGames || existing?.allowedGames);
  const rows = sanitizeRows(topic.rows ?? existing?.rows ?? [], topicId);
  const name = normalizeWhitespace(topic.name ?? topic.title ?? existing?.name ?? "Untitled");
  const source = topic.source ?? existing?.source ?? "local";
  const createdAt = existing?.createdAt ?? topic.createdAt ?? Date.now();
  const updatedAt = topic.updatedAt ?? existing?.updatedAt ?? Date.now();

  return {
    id: topicId,
    name,
    fileName: topic.fileName || existing?.fileName || `${name}.csv`,
    path: topic.path || existing?.path || topicId,
    lang: topic.lang || existing?.lang || "",
    topicName,
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

  const existing = topics[index];
  topics[index] = sanitizeTopic(updated, existing);
  const saved = safeSet(LIBRARY_KEY, topics);
  return saved ? topics[index] : existing;
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

  consumeLastError() {
    const error = lastStorageError;
    lastStorageError = null;
    return error;
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
    const {
      lang = null,
      category = null,
      topicName = null,
      branch = null,
      group = null,
      excludeId = null,
    } = options;
    const normalizedTopic = topicName
      ? normalizeTopicName(topicName, "")
      : branch || group
        ? resolveTopicName({ branch, group }, null)
        : "";

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

      if (normalizedTopic && topic.topicName !== normalizedTopic) {
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
    return updateTopicInCollection(topicId, (topic) => {
      const existingRow = topic.rows.find((row) => row.id === rowId);
      if (!existingRow) {
        return null;
      }

      const nextRow = sanitizeRow({ ...existingRow, ...changes }, `${topicId}-row`);
      if (!nextRow) {
        return null;
      }

      return {
        ...topic,
        rows: topic.rows.map((row) => (row.id === rowId ? nextRow : row)),
      };
    });
  },

  removeLibraryRow(topicId, rowId) {
    const topics = this.getLibraryTopics();
    const index = topics.findIndex((topic) => topic.id === topicId);

    if (index < 0) {
      return null;
    }

    const topic = topics[index];
    const nextRows = topic.rows.filter((row) => row.id !== rowId);

    if (nextRows.length === topic.rows.length) {
      return topic;
    }

    if (nextRows.length === 0) {
      topics.splice(index, 1);
      const saved = safeSet(LIBRARY_KEY, topics);
      return saved ? null : topic;
    }

    topics[index] = sanitizeTopic(
      {
        ...topic,
        rows: nextRows,
        updatedAt: Date.now(),
      },
      topic,
    );
    const saved = safeSet(LIBRARY_KEY, topics);
    return saved ? topics[index] : topic;
  },

  removeLibraryTopic(topicId) {
    const topics = this.getLibraryTopics();
    const topic = topics.find((entry) => entry.id === topicId) || null;

    if (!topic) {
      return false;
    }

    const nextTopics = topics.filter((entry) => entry.id !== topicId);
    return safeSet(LIBRARY_KEY, nextTopics);
  },

  findLibraryTopicByOrigin(originPath) {
    return (
      this.getLibraryTopics().find((topic) => topic.originPath && topic.originPath === originPath) ||
      null
    );
  },

  migrateLegacyHiddenOrigins() {
    const legacyOrigins = getLegacyHiddenOrigins();

    if (!legacyOrigins.length) {
      return { moved: 0, failed: false };
    }

    const mergedOrigins = [...new Set([...getHiddenLibraryHubOrigins(), ...legacyOrigins])];
    if (!setHiddenLibraryHubOrigins(mergedOrigins)) {
      return { moved: 0, failed: true };
    }

    if (!safeRemove(HIDDEN_ORIGINS_KEY) && !setLegacyHiddenOrigins([])) {
      return { moved: legacyOrigins.length, failed: true };
    }

    return { moved: legacyOrigins.length, failed: false };
  },

  getHiddenOrigins() {
    return getHiddenLibraryHubOrigins();
  },

  isOriginHidden(originPath) {
    return this.isLibraryOriginHidden(originPath);
  },

  getHiddenLibraryHubOrigins() {
    return getHiddenLibraryHubOrigins();
  },

  isLibraryOriginHidden(originPath) {
    return Boolean(originPath) && getHiddenLibraryHubOrigins().includes(originPath);
  },

  hideLibraryOrigin(originPath) {
    if (!originPath) {
      return false;
    }

    return setHiddenLibraryHubOrigins([...getHiddenLibraryHubOrigins(), originPath]);
  },

  unhideLibraryOrigin(originPath) {
    if (!originPath) {
      return false;
    }

    return setHiddenLibraryHubOrigins(
      getHiddenLibraryHubOrigins().filter((entry) => entry !== originPath),
    );
  },

  hideOrigin(originPath) {
    return this.hideLibraryOrigin(originPath);
  },

  unhideOrigin(originPath) {
    return this.unhideLibraryOrigin(originPath);
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
    const [primaryTopicId] = resolveTopicStorageCandidates(topicMeta);
    const sessionKey = buildKey("sessions", game, primaryTopicId);
    const sessions = safeGet(sessionKey, []);

    sessions.push({
      date: Date.now(),
      topic: topicMeta.name,
      topicName: normalizeTopicName(topicMeta.topicName, ""),
      lang: topicMeta.lang,
      path: topicMeta.path,
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
      topicName: normalizeTopicName(topicMeta.topicName, ""),
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
    const candidates = resolveTopicStorageCandidates(topicId);
    const merged = candidates.flatMap((candidate) =>
      safeGet(buildKey("sessions", game, candidate), []),
    );

    if (merged.length === 0) {
      return [];
    }

    return merged
      .sort((left, right) => (right.date || 0) - (left.date || 0))
      .slice(0, 100);
  },

  getAllSessions() {
    return safeGet(buildKey("sessions", "all"), []);
  },

  updateBestTime(game, topicId, time) {
    const candidates = resolveTopicStorageCandidates(topicId);
    const primaryKey = buildKey("best", game, candidates[0]);
    const current = candidates.reduce((best, candidate) => {
      const value = safeGet(buildKey("best", game, candidate), 0);
      if (!value) {
        return best;
      }

      if (!best || value < best) {
        return value;
      }

      return best;
    }, 0);

    if (!current || time < current) {
      safeSet(primaryKey, time);
      return true;
    }

    return false;
  },

  getBestTime(game, topicId) {
    return resolveTopicStorageCandidates(topicId).reduce((best, candidate) => {
      const value = safeGet(buildKey("best", game, candidate), 0);
      if (!value) {
        return best;
      }

      if (!best || value < best) {
        return value;
      }

      return best;
    }, 0);
  },

  addHardItem(game, topicMeta, item) {
    const topicId =
      typeof topicMeta === "string"
        ? topicMeta
        : topicMeta?.id || topicMeta?.path || "global";
    const key = buildKey("hard", game, topicId);
    const items = safeGet(key, {});
    const itemId =
      typeof topicMeta === "string"
        ? typeof item === "string"
          ? item
          : item?.id || ""
        : buildHardItemSignature(topicMeta, item) || item?.id || "";

    if (!itemId) {
      return;
    }

    items[itemId] = (items[itemId] || 0) + 1;
    safeSet(key, items);
  },

  getHardItems(game, topicId) {
    return safeGet(buildKey("hard", game, topicId), {});
  },

  getAllHardItems() {
    const prefix = `${PREFIX}_${VERSION}_hard_`;
    const result = new Map();

    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(prefix)) {
        return;
      }

      const raw = safeGet(key, {});
      Object.entries(raw).forEach(([itemId, count]) => {
        const parsed = parseHardItemSignature(itemId);
        const existing = result.get(itemId) || {
          itemId,
          count: 0,
          lang: parsed?.lang || null,
          category: parsed?.category || null,
          source: parsed?.source || null,
          target: parsed?.target || null,
        };

        existing.count += Number(count) || 0;
        result.set(itemId, existing);
      });
    });

    return [...result.values()];
  },

  getHardListRows(lang, category) {
    return this.getAllHardItems()
      .filter((item) => {
        if (!item.lang || !item.source || !item.target) {
          return false;
        }

        if (lang && item.lang !== lang) {
          return false;
        }

        if (category && item.category !== category) {
          return false;
        }

        return item.count >= 2;
      })
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return `${left.source}|${left.target}`.localeCompare(
          `${right.source}|${right.target}`,
        );
      })
      .map((item) => ({
        id: item.itemId,
        source: item.source,
        target: item.target,
      }));
  },

  getHardListSummary(lang = null) {
    const items = this.getAllHardItems().filter((item) => {
      if (!item.lang || !item.source || !item.target) {
        return false;
      }

      if (lang && item.lang !== lang) {
        return false;
      }

      return item.count >= 2;
    });

    const words = items.filter((item) => item.category !== SENTENCE_TOPIC_NAME).length;
    const sentences = items.filter((item) => item.category === SENTENCE_TOPIC_NAME).length;

    return {
      words,
      sentences,
      total: words + sentences,
    };
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
