function createField(field, index) {
  const wrapper = document.createElement("label");
  wrapper.className = "app-modal__field";

  if (field.label) {
    const label = document.createElement("span");
    label.className = "app-modal__field-label";
    label.textContent = field.label;
    wrapper.appendChild(label);
  }

  const isMultiline = field.multiline === true;
  const control = document.createElement(isMultiline ? "textarea" : "input");
  control.className = "app-modal__input";
  control.name = field.id || `field-${index}`;
  control.placeholder = field.placeholder || "";
  control.value = field.value || "";
  control.autocomplete = field.autocomplete || "off";

  if (!isMultiline) {
    control.type = field.type || "text";
  } else {
    control.rows = field.rows || 4;
  }

  wrapper.appendChild(control);

  return {
    wrapper,
    control,
    id: control.name,
  };
}

function createModalShell(options) {
  const backdrop = document.createElement("div");
  backdrop.className = "app-modal-backdrop";

  const dialog = document.createElement("section");
  dialog.className = `app-modal app-modal--${options.tone || "default"}`;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  if (options.title) {
    const title = document.createElement("h3");
    title.className = "app-modal__title";
    title.textContent = options.title;
    dialog.appendChild(title);
  }

  if (options.message) {
    const message = document.createElement("p");
    message.className = "app-modal__message";
    message.textContent = options.message;
    dialog.appendChild(message);
  }

  const fieldRefs = [];
  if (Array.isArray(options.fields) && options.fields.length > 0) {
    const body = document.createElement("div");
    body.className = "app-modal__body";

    options.fields.forEach((field, index) => {
      const fieldRef = createField(field, index);
      fieldRefs.push(fieldRef);
      body.appendChild(fieldRef.wrapper);
    });

    dialog.appendChild(body);
  }

  const error = document.createElement("p");
  error.className = "app-modal__error";
  error.hidden = true;
  dialog.appendChild(error);

  const actions = document.createElement("div");
  actions.className = "app-modal__actions";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className =
    options.tone === "danger"
      ? "button button-danger"
      : "button button-primary";
  confirmButton.textContent = options.confirmLabel || "OK";
  actions.appendChild(confirmButton);

  let cancelButton = null;
  if (options.showCancel !== false) {
    cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "button button-secondary";
    cancelButton.textContent = options.cancelLabel || "Cancel";
    actions.appendChild(cancelButton);
  }

  dialog.appendChild(actions);
  backdrop.appendChild(dialog);

  return {
    backdrop,
    dialog,
    error,
    confirmButton,
    cancelButton,
    fieldRefs,
  };
}

function readFieldValues(fieldRefs) {
  return fieldRefs.reduce((result, fieldRef) => {
    result[fieldRef.id] = fieldRef.control.value;
    return result;
  }, {});
}

function normalizeResult(values, options) {
  if (typeof options.transform === "function") {
    return options.transform(values);
  }

  const entries = Object.entries(values);
  if (entries.length === 1) {
    return entries[0][1];
  }

  return values;
}

function focusInitialTarget(shell) {
  const firstControl = shell.fieldRefs[0]?.control;
  const target = firstControl || shell.confirmButton;
  target?.focus();

  if (firstControl && typeof firstControl.select === "function") {
    firstControl.select();
  }
}

function openModal(options = {}) {
  return new Promise((resolve) => {
    const shell = createModalShell(options);
    const previousOverflow = document.body.style.overflow;
    let settled = false;

    const cleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      shell.backdrop.remove();
      document.body.style.overflow = previousOverflow;
    };

    const settle = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const showError = (message) => {
      shell.error.hidden = !message;
      shell.error.textContent = message || "";
    };

    const confirm = () => {
      const values = readFieldValues(shell.fieldRefs);
      const validationMessage = typeof options.validate === "function"
        ? options.validate(values)
        : "";

      if (validationMessage) {
        showError(validationMessage);
        return;
      }

      showError("");
      settle(normalizeResult(values, options));
    };

    const cancel = () => {
      settle(null);
    };

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }

      if (event.key !== "Enter") {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLTextAreaElement &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }

      if (activeElement === shell.cancelButton) {
        return;
      }

      event.preventDefault();
      confirm();
    };

    shell.confirmButton.addEventListener("click", confirm);
    shell.cancelButton?.addEventListener("click", cancel);
    shell.backdrop.addEventListener("click", (event) => {
      if (event.target === shell.backdrop && options.dismissOnBackdrop !== false) {
        cancel();
      }
    });

    document.body.appendChild(shell.backdrop);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeydown, true);
    focusInitialTarget(shell);
  });
}

function openCustomModal(buildModal) {
  return new Promise((resolve) => {
    const modal = buildModal();
    const previousOverflow = document.body.style.overflow;
    let settled = false;

    const cleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      modal.backdrop.remove();
      document.body.style.overflow = previousOverflow;
      modal.cleanup?.();
    };

    const settle = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(null);
      }
    };

    modal.closeButton?.addEventListener("click", () => settle(null));
    modal.backdrop.addEventListener("click", (event) => {
      if (event.target === modal.backdrop) {
        settle(null);
      }
    });

    document.body.appendChild(modal.backdrop);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeydown, true);
    modal.initialFocusTarget?.focus?.();
  });
}

function createAboutSection({ id, title, items, prompt = "" }) {
  const section = document.createElement("section");
  section.className = "app-modal__section";
  section.id = id;

  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement("ul");
  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    list.appendChild(listItem);
  });
  section.appendChild(list);

  if (prompt) {
    const textarea = document.createElement("textarea");
    textarea.className = "app-modal__input app-modal__prompt";
    textarea.readOnly = true;
    textarea.value = prompt;

    const actions = document.createElement("div");
    actions.className = "app-modal__prompt-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "button button-primary button-small";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 1400);
      } catch (error) {
        console.error("Clipboard write failed", error);
        copyButton.textContent = "Copy failed";
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 1600);
      }
    });

    actions.appendChild(copyButton);
    section.append(textarea, actions);
  }

  return section;
}

function createAboutModal() {
  const introLines = [
    "ONE SOURCE is an open game-based platform for language learning, supporting any language pair.",
    "Users can create learning content independently or use AI to generate customized materials.",
    "The system converts various texts such as stories, articles, and images into a structured learning format including words, sentences, and interactive exercises.",
    "Users can build a personal content library, organize it by topics and difficulty levels, and practice using different learning modes.",
  ];

  const sections = [
    {
      id: "about-start-here",
      title: "Start Here",
      items: [
        "Choose a language pair.",
        "Create a list or import a CSV.",
        "Open the list in My lists.",
        "Start a game.",
      ],
    },
    {
      id: "about-csv-rules",
      title: "CSV Rules",
      items: [
        "Use exactly: learning,translation",
        "Keep exactly 2 columns per row.",
        "Both sides are required.",
        "Quote any field that contains a comma.",
        "Do not add notes, tags, or extra columns.",
      ],
    },
    {
      id: "about-local-data",
      title: "Your Data Is Local",
      items: [
        "Lists and progress stay in this browser on this device.",
        "Clearing browser data can remove them.",
        "Private or incognito mode may not keep them.",
        "Export important lists as backup.",
      ],
    },
    {
      id: "about-ai-prompt",
      title: "Copy This AI Prompt",
      items: [
        "Use this as a starting prompt.",
      ],
      prompt: [
        "Create a CSV word list for [language pair] about [topic].",
        "Output CSV only.",
        "Use exactly 2 columns: learning,translation.",
        "No header unless requested.",
        "No notes, no numbering, no markdown, no code fences.",
        "Quote any field that contains a comma.",
      ].join("\n"),
    },
  ];

  const backdrop = document.createElement("div");
  backdrop.className = "app-modal-backdrop";

  const dialog = document.createElement("section");
  dialog.className = "app-modal app-modal--wide";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "aboutModalTitle");

  const header = document.createElement("div");
  header.className = "app-modal__header";

  const title = document.createElement("h3");
  title.className = "app-modal__title";
  title.id = "aboutModalTitle";
  title.textContent = "About";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "icon-button app-modal__close";
  closeButton.textContent = "Close";

  header.append(title, closeButton);
  dialog.appendChild(header);

  const toc = document.createElement("nav");
  toc.className = "app-modal__toc";
  toc.setAttribute("aria-label", "About sections");
  dialog.appendChild(toc);

  const viewport = document.createElement("div");
  viewport.className = "app-modal__viewport";
  dialog.appendChild(viewport);

  const intro = document.createElement("div");
  intro.className = "app-modal__intro";
  introLines.forEach((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    intro.appendChild(paragraph);
  });
  viewport.appendChild(intro);

  const sectionList = document.createElement("div");
  sectionList.className = "app-modal__section-list";
  viewport.appendChild(sectionList);

  const sectionNodes = sections.map((section) => {
    const link = document.createElement("a");
    link.className = "app-modal__toc-link";
    link.href = `#${section.id}`;
    link.textContent = section.title;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      viewport.querySelector(`#${section.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    toc.appendChild(link);

    const node = createAboutSection(section);
    sectionList.appendChild(node);

    return { link, node };
  });

  const updateActiveSection = () => {
    let activeNode = sectionNodes[0];
    const viewportTop = viewport.getBoundingClientRect().top;

    sectionNodes.forEach((entry) => {
      const top = entry.node.getBoundingClientRect().top - viewportTop;
      if (top <= 80) {
        activeNode = entry;
      }
    });

    sectionNodes.forEach((entry) => {
      entry.link.classList.toggle("is-active", entry === activeNode);
    });
  };

  viewport.addEventListener("scroll", updateActiveSection, { passive: true });
  requestAnimationFrame(updateActiveSection);
  backdrop.appendChild(dialog);

  return {
    backdrop,
    closeButton,
    initialFocusTarget: closeButton,
    cleanup: () => {
      viewport.removeEventListener("scroll", updateActiveSection);
    },
  };
}

export const Modal = {
  alert(message, options = {}) {
    return openModal({
      title: options.title || "Notice",
      message,
      confirmLabel: options.confirmLabel || "OK",
      showCancel: false,
      dismissOnBackdrop: false,
      tone: options.tone || "default",
    });
  },

  error(message, options = {}) {
    console.error(message);
    return openModal({
      title: options.title || "Something went wrong",
      message,
      confirmLabel: options.confirmLabel || "OK",
      showCancel: false,
      dismissOnBackdrop: false,
      tone: "danger",
    });
  },

  confirm(message, options = {}) {
    return openModal({
      title: options.title || "Please confirm",
      message,
      confirmLabel: options.confirmLabel || "Confirm",
      cancelLabel: options.cancelLabel || "Cancel",
      showCancel: true,
      dismissOnBackdrop: options.dismissOnBackdrop !== false,
      tone: options.tone || "default",
      transform: (values) => values,
    }).then((result) => result !== null);
  },

  prompt(message, initialValue = "", options = {}) {
    return openModal({
      title: options.title || "Input",
      message,
      confirmLabel: options.confirmLabel || "Save",
      cancelLabel: options.cancelLabel || "Cancel",
      dismissOnBackdrop: options.dismissOnBackdrop !== false,
      tone: options.tone || "default",
      fields: [
        {
          id: "value",
          label: options.label || "",
          value: initialValue,
          placeholder: options.placeholder || "",
          type: options.type || "text",
          autocomplete: options.autocomplete || "off",
        },
      ],
      validate: options.validate,
      transform: (values) => values.value,
    });
  },

  form(options = {}) {
    return openModal({
      title: options.title || "Edit",
      message: options.message || "",
      confirmLabel: options.confirmLabel || "Save",
      cancelLabel: options.cancelLabel || "Cancel",
      dismissOnBackdrop: options.dismissOnBackdrop !== false,
      tone: options.tone || "default",
      fields: options.fields || [],
      validate: options.validate,
      transform: options.transform,
    });
  },

  about() {
    return openCustomModal(() => createAboutModal());
  },
};
