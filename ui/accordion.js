export function renderAccordionTree(tree, options = {}) {
  const { onSelect = () => {}, selectedId = null, openFirstRoot = true } = options;
  const fragment = document.createDocumentFragment();
  const branches = Object.keys(tree);

  if (branches.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No topics are available for this selection.";
    fragment.appendChild(emptyState);
    return fragment;
  }

  branches.forEach((branchName, branchIndex) => {
    const accordion = document.createElement("section");
    accordion.className = "accordion";
    accordion.classList.toggle("open", openFirstRoot && branchIndex === 0);
    accordion.classList.add(
      branchName.trim().toLowerCase() === "my lists"
        ? "accordion--mine"
        : "accordion--hub",
    );

    const header = document.createElement("button");
    header.type = "button";
    header.className = "accordion__header";
    header.textContent = branchName;
    header.addEventListener("click", () => {
      accordion.classList.toggle("open");
    });

    const content = document.createElement("div");
    content.className = "accordion__content";

    Object.keys(tree[branchName]).forEach((groupName) => {
      const group = document.createElement("div");
      group.className = "accordion__group";

      const title = document.createElement("div");
      title.className = "accordion__group-title";
      title.textContent = groupName;
      group.appendChild(title);

      tree[branchName][groupName].forEach((fileMeta) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "topic-button";
        button.textContent = fileMeta.name;
        button.classList.toggle("is-selected", fileMeta.id === selectedId);
        button.addEventListener("click", () => {
          onSelect(fileMeta);
        });
        group.appendChild(button);
      });

      content.appendChild(group);
    });

    accordion.appendChild(header);
    accordion.appendChild(content);
    fragment.appendChild(accordion);
  });

  return fragment;
}
