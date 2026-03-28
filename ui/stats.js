import { formatTime, safePercent } from "../utils/helpers.js";

function createStatTile(label, value) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";

  const valueNode = document.createElement("strong");
  valueNode.textContent = value;

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  tile.append(valueNode, labelNode);
  return tile;
}

function createListSection(title, rows) {
  const section = document.createElement("section");
  section.className = "stats-section";

  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No data yet.";
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement("div");
  list.className = "stat-list";

  rows.forEach(({ label, value }) => {
    const row = document.createElement("div");
    row.className = "stat-row";

    const labelNode = document.createElement("span");
    labelNode.textContent = label;

    const valueNode = document.createElement("strong");
    valueNode.textContent = value;

    row.append(labelNode, valueNode);
    list.appendChild(row);
  });

  section.appendChild(list);
  return section;
}

export function renderStats(container, summary) {
  const {
    sessions,
    hardSummary,
    storageUsage,
  } = summary;

  container.innerHTML = "";

  const totalSessions = sessions.length;
  const totalTime = sessions.reduce((sum, session) => sum + (session.time || 0), 0);
  const totalCorrect = sessions.reduce(
    (sum, session) => sum + (session.correct || 0),
    0,
  );
  const totalAttempts = sessions.reduce(
    (sum, session) => sum + (session.attempts || 0),
    0,
  );

  const grid = document.createElement("div");
  grid.className = "stats-grid";
  grid.append(
    createStatTile("Sessions", String(totalSessions)),
    createStatTile("Study time", formatTime(totalTime)),
    createStatTile("Accuracy", `${safePercent(totalCorrect, totalAttempts)}%`),
  );
  container.appendChild(grid);

  const byGameMap = new Map();
  const byLangMap = new Map();

  sessions.forEach((session) => {
    const gameBucket = byGameMap.get(session.game) || { count: 0, time: 0 };
    gameBucket.count += 1;
    gameBucket.time += session.time || 0;
    byGameMap.set(session.game, gameBucket);

    const langBucket = byLangMap.get(session.lang) || { count: 0, time: 0 };
    langBucket.count += 1;
    langBucket.time += session.time || 0;
    byLangMap.set(session.lang, langBucket);
  });

  const byGame = [...byGameMap.entries()].map(([game, data]) => ({
    label: game,
    value: `${data.count} sessions / ${formatTime(Math.round(data.time / data.count || 0))} avg`,
  }));

  const byLanguage = [...byLangMap.entries()].map(([lang, data]) => ({
    label: lang,
    value: `${data.count} sessions / ${formatTime(Math.round(data.time / data.count || 0))} avg`,
  }));

  const recentSessions = [...sessions]
    .sort((left, right) => right.date - left.date)
    .slice(0, 8)
    .map((session) => ({
      label: `${session.game} / ${session.topic}`,
      value: `${formatTime(session.time || 0)} / ${safePercent(
        session.correct || 0,
        session.attempts || 0,
      )}%`,
    }));

  container.append(
    createListSection("By game", byGame),
    createListSection("By language", byLanguage),
    createListSection("Recent sessions", recentSessions),
    createListSection("Hard lists", [
      { label: "Hard words", value: String(hardSummary?.words || 0) },
      { label: "Hard sentences", value: String(hardSummary?.sentences || 0) },
    ]),
    createListSection("Storage", [
      { label: "Estimated usage", value: `${storageUsage.kb} KB` },
    ]),
  );
}
