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

export function renderLibraryTopics(mount, options = {}) {
  const {
    topics = [],
    onManage = () => {},
    onStart = () => {},
  } = options;

  mount.innerHTML = "";

  if (topics.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No lists are available for this selection yet.";
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
    topicName.textContent = topic.topicName;

    const name = document.createElement("span");
    name.className = "library-topic-card__name";
    name.textContent = topic.name;

    path.append(
      lang,
      document.createTextNode(" | "),
      topicName,
      document.createTextNode(" | "),
      name,
    );

    const actionRow = document.createElement("div");
    actionRow.className = "library-topic-card__actions";
    actionRow.appendChild(
      createButton(
        topic.source === "hub" ? "Manage list" : "Edit list",
        "button button-secondary button-small",
        () => onManage(topic),
      ),
    );

    (topic.allowedGames || []).forEach((gameId) => {
      actionRow.appendChild(
        createButton(
          formatGameLabel(gameId),
          "button button-primary button-small",
          () => onStart(topic, gameId),
        ),
      );
    });

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

    const source = document.createElement("p");
    source.className = "library-row-card__source";
    source.textContent = `${index + 1}. ${row.source}`;

    const target = document.createElement("p");
    target.className = "library-row-card__target";
    target.textContent = row.target;

    values.append(source, target);

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
