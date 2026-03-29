function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function formatGameLabel(gameId) {
  const labels = {
    flashcards: "Flash Cards",
    wordmatch: "Word Match",
    wordpuzzle: "Word Puzzle",
  };

  return labels[gameId] || gameId;
}

function getSourceBadge(topic) {
  if (topic.source === "hub" || topic.source === "hub-cache") {
    return "HUB";
  }

  return "MINE";
}

export function renderLibraryTopics(mount, options = {}) {
  const {
    topics = [],
    onEdit = () => {},
    onDelete = () => {},
    onStart = () => {},
  } = options;

  mount.innerHTML = "";

  if (topics.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No local lists are available yet.";
    mount.appendChild(emptyState);
    return;
  }

  topics.forEach((topic) => {
    const card = document.createElement("article");
    card.className = "library-topic-card";

    const path = document.createElement("p");
    path.className = "library-topic-card__path";

    const lang = document.createElement("span");
    lang.textContent = topic.lang;

    const topicName = document.createElement("span");
    topicName.className = "library-path__topic";
    topicName.textContent = topic.name || topic.fileName || "";

    const name = document.createElement("span");
    name.className = "library-topic-card__name library-path__name";
    name.textContent = topic.topicName || topic.originMeta?.topic || "";

    const badge = document.createElement("span");
    badge.className = `library-topic-card__badge library-topic-card__badge--${getSourceBadge(topic).toLowerCase()}`;
    badge.textContent = getSourceBadge(topic);

    path.append(
      lang,
      document.createTextNode(" | "),
      topicName,
      document.createTextNode(" | "),
      name,
      document.createTextNode(" "),
      badge,
    );

    const actionRow = document.createElement("div");
    actionRow.className = "library-topic-card__actions";
    const gameActions = document.createElement("div");
    gameActions.className = "library-topic-card__games";
    const manageActions = document.createElement("div");
    manageActions.className = "library-topic-card__manage";

    (topic.allowedGames || []).forEach((gameId) => {
      gameActions.appendChild(
        createButton(
          formatGameLabel(gameId),
          "button button-primary button-small",
          () => onStart(topic, gameId),
        ),
      );
    });

    manageActions.appendChild(
      createButton(
        "Edit",
        "button button-secondary button-small",
        () => onEdit(topic),
      ),
    );

    manageActions.appendChild(
      createButton(
        "Delete",
        "button button-danger button-small",
        () => onDelete(topic),
      ),
    );

    if (gameActions.childElementCount > 0) {
      actionRow.appendChild(gameActions);
    }

    actionRow.appendChild(manageActions);

    card.append(path, actionRow);
    mount.appendChild(card);
  });
}

export function renderLibraryRows(mount, options = {}) {
  const {
    rows = [],
    onEdit = () => {},
    onDelete = () => {},
  } = options;

  mount.innerHTML = "";

  if (rows.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "This list has no rows yet.";
    mount.appendChild(emptyState);
    return;
  }

  rows.forEach((row, index) => {
    const card = document.createElement("article");
    card.className = "library-row-card";

    const values = document.createElement("div");
    values.className = "library-row-card__values";

    const line = document.createElement("p");
    line.className = "library-row-card__line";
    line.textContent = `${index + 1}. ${row.source} - ${row.target}`;

    values.append(line);

    const actions = document.createElement("div");
    actions.className = "library-row-card__actions";
    actions.appendChild(
      createButton("Edit", "button button-secondary button-small", () => onEdit(row.id)),
    );
    actions.appendChild(
      createButton("Delete", "button button-danger button-small", () => onDelete(row.id)),
    );

    card.append(values, actions);
    mount.appendChild(card);
  });
}
