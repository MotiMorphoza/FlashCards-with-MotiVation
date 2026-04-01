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

function sanitizeFileBaseName(value) {
  const sanitized = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return sanitized || "learning-list";
}

function supportsOptionalDiacritics(languageLabel = "") {
  const value = String(languageLabel || "");
  const normalized = value.toLowerCase();
  const compact = normalized.replace(/\s+/g, "");

  return (
    /hebrew/.test(normalized)
    || /arabic/.test(normalized)
    || /(^|[^a-z])he([^a-z]|$)/.test(normalized)
    || /(^|[^a-z])ar([^a-z]|$)/.test(normalized)
    || compact === "he"
    || compact === "ar"
    || compact.startsWith("he-")
    || compact.startsWith("ar-")
    || /\u05e2\u05d1\u05e8\u05d9\u05ea/.test(value)
    || /[\u0590-\u05FF]/.test(value)
    || /\u0627\u0644\u0639\u0631\u0628\u064a\u0629|\u0639\u0631\u0628\u064a|\u0639\u0631\u0628\u064a\u0629/.test(value)
    || /[\u0600-\u06FF]/.test(value)
  );
}

function createLabeledInput(labelText, control, options = {}) {
  const wrapper = document.createElement("label");
  wrapper.className = "app-modal__field";

  if (options.fullWidth) {
    wrapper.classList.add("app-modal__field--full");
  }

  const label = document.createElement("span");
  label.className = "app-modal__field-label";
  label.textContent = labelText;
  wrapper.append(label, control);

  return wrapper;
}

function createSelectControl(options, selectedValue) {
  const select = document.createElement("select");
  select.className = "app-modal__input";

  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    if (option.value === selectedValue) {
      node.selected = true;
    }
    select.appendChild(node);
  });

  return select;
}

function createCheckboxOption(value, labelText, checked = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "app-modal__chip-option";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = value;
  input.checked = checked;
  input.className = "app-modal__chip-input";

  const text = document.createElement("span");
  text.className = "app-modal__chip-label";
  text.textContent = labelText;

  wrapper.append(input, text);
  return { wrapper, input };
}

function buildAiPromptText(state) {
  const lines = [
    "Create a plain-text learning file for a language-learning app.",
    `The result must be ready to save as "${state.fileName}.txt".`,
    "",
    `Source type: ${state.sourceTypeLabel}`,
    `Learning language: ${state.learningLanguage}`,
    `User language: ${state.userLanguage}`,
    `Output types: ${state.outputTypes.join(", ")}`,
    `Quantity: ${state.quantity} total rows`,
    `Difficulty: ${state.difficulty}`,
  ];

  if (state.sourceType === "text") {
    lines.push(`Text mode: ${state.textModeLabel}`);
  }

  if (state.outputTypes.includes("full sentences")) {
    lines.push(`Sentence length: ${state.sentenceLength}`);
  }

  if (state.showDiacriticsControl) {
    lines.push(
      `Diacritics: ${state.includeDiacritics
        ? "include native diacritics when appropriate"
        : "do not include optional diacritics where possible, without forcing unnatural spelling"}`,
    );
  }

  lines.push("", "Source handling:");

  if (state.sourceType === "text") {
    lines.push("- After this prompt, I will paste the source text directly into the AI tool.");

    if (state.textMode === "exact-extraction") {
      lines.push(
        "- Use only content explicitly present in the source.",
        "- Extract words, short phrases, and full sentences directly from the source.",
        "- Do not invent new sentences.",
        "- Do not summarize the source.",
        "- Preserve the source tone, meaning, and colloquial style when useful and study-safe.",
        "- Allow only minimal cleanup for clarity, punctuation, or study safety.",
        "- Prefer lightly cleaned source-based units over rewritten ones.",
      );
    } else {
      lines.push(
        "- Stay anchored to the source topic, vocabulary, tone, and meaning.",
        "- Lightly adapt the source into study-ready units.",
        "- Avoid heavy paraphrase or invention.",
        "- Do not drift into unrelated generic examples.",
        "- Keep the source flavor when possible.",
      );
    }
  } else if (state.sourceType === "image") {
    lines.push(
      "- After this prompt, I will upload the image directly into the AI tool.",
      "- Use only clearly visible elements.",
      "- Do not hallucinate uncertain details.",
      "- Derive simple, useful learning units from the visible content.",
    );
  } else {
    lines.push(
      `- Topic / need / scenario: ${state.freeTextRequest}`,
      "- Create original content from scratch based on this request.",
      "- This is not source extraction.",
      "- Keep the output practical, focused, and study-ready.",
    );
  }

  lines.push(
    "",
    "Output rules:",
    "- Return plain text only.",
    "- No title.",
    "- No header.",
    "- No explanations.",
    "- No notes.",
    "- No numbering.",
    "- No bullets.",
    "- No blank lines.",
    "- Each line must be actual game content, not labels, metadata, or examples.",
    "- In each line, put the learning-language content first and the user-language content second.",
    "- Separate the two fields with exactly one vertical bar.",
    "- Use exactly one | per line.",
    "- Never use | inside content.",
    "- If | would appear inside content, replace it with -.",
    "- Use only the selected output types.",
    "- Quantity means total rows, not rows per type.",
  );

  if (state.outputTypes.length > 1) {
    lines.push(
      "- Produce a balanced mix across the selected output types.",
      "- Interleave the selected types naturally.",
      "- Do not cluster all items of one type together.",
    );
  }

  lines.push(
    "- Keep the content natural, useful, and ready for study.",
    "- Keep the difficulty aligned with the selected level.",
    "- Do not output duplicate rows.",
  );

  if (state.outputTypes.includes("full sentences")) {
    lines.push(`- Keep full sentences ${state.sentenceLength}.`);
  }

  lines.push(
    "",
    "Before finalizing, silently verify:",
    `- exactly ${state.quantity} rows`,
    "- exactly one | per line",
    "- no extra | inside content",
    "- no blank lines",
    "- no text outside the rows",
    "",
    "Now generate the output.",
  );

  return lines.join("\n");
}

function createAiPromptGenerator(defaults = {}) {
  const generator = document.createElement("div");
  generator.className = "app-modal__generator";

  const grid = document.createElement("div");
  grid.className = "app-modal__generator-grid";
  generator.appendChild(grid);

  const fileNameInput = document.createElement("input");
  fileNameInput.className = "app-modal__input";
  fileNameInput.type = "text";
  fileNameInput.placeholder = "learning-list";
  fileNameInput.value = defaults.fileBaseName || "";
  grid.appendChild(createLabeledInput("File name", fileNameInput));

  const sourceTypeSelect = createSelectControl([
    { value: "text", label: "Text" },
    { value: "image", label: "Image" },
    { value: "free-text", label: "Free text" },
  ], defaults.sourceType || "text");
  grid.appendChild(createLabeledInput("Source type", sourceTypeSelect));

  const textModeField = document.createElement("div");
  textModeField.className = "app-modal__field";
  const textModeLabel = document.createElement("span");
  textModeLabel.className = "app-modal__field-label";
  textModeLabel.textContent = "Text mode";
  const textModeSelect = createSelectControl([
    { value: "exact-extraction", label: "Exact extraction" },
    { value: "source-based-adaptive", label: "Source-based adaptive" },
  ], defaults.textMode || "exact-extraction");
  const textModeHelp = document.createElement("div");
  textModeHelp.className = "app-modal__helper-stack";
  [
    "Exact extraction: extract only from the source.",
    "Source-based adaptive: lightly adapt the source into study-ready units.",
  ].forEach((line) => {
    const note = document.createElement("p");
    note.className = "app-modal__field-help";
    note.textContent = line;
    textModeHelp.appendChild(note);
  });
  textModeField.append(textModeLabel, textModeSelect, textModeHelp);
  grid.appendChild(textModeField);

  const outputField = document.createElement("div");
  outputField.className = "app-modal__field";
  const outputLabel = document.createElement("span");
  outputLabel.className = "app-modal__field-label";
  outputLabel.textContent = "Output types";
  const outputGrid = document.createElement("div");
  outputGrid.className = "app-modal__chip-row app-modal__chip-row--scroll";
  const outputOptions = [
    createCheckboxOption("words", "Words", true),
    createCheckboxOption("short phrases", "Short phrases", false),
    createCheckboxOption("full sentences", "Full sentences", false),
  ];
  outputOptions.forEach((option) => outputGrid.appendChild(option.wrapper));
  outputField.append(outputLabel, outputGrid);
  grid.appendChild(outputField);

  const learningLanguageInput = document.createElement("input");
  learningLanguageInput.className = "app-modal__input";
  learningLanguageInput.type = "text";
  learningLanguageInput.placeholder = "Learning language";
  learningLanguageInput.value = defaults.learningLanguage || "";
  grid.appendChild(createLabeledInput("Learning language", learningLanguageInput));

  const userLanguageInput = document.createElement("input");
  userLanguageInput.className = "app-modal__input";
  userLanguageInput.type = "text";
  userLanguageInput.placeholder = "User language";
  userLanguageInput.value = defaults.userLanguage || "";
  grid.appendChild(createLabeledInput("User language", userLanguageInput));

  const quantityInput = document.createElement("input");
  quantityInput.className = "app-modal__input";
  quantityInput.type = "number";
  quantityInput.min = "5";
  quantityInput.max = "30";
  quantityInput.step = "1";
  quantityInput.value = String(defaults.quantity || 10);
  grid.appendChild(createLabeledInput("Quantity (total rows)", quantityInput));

  const difficultySelect = createSelectControl([
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
  ], defaults.difficulty || "beginner");
  grid.appendChild(createLabeledInput("Difficulty", difficultySelect));

  const freeTextInput = document.createElement("textarea");
  freeTextInput.className = "app-modal__input";
  freeTextInput.rows = 3;
  freeTextInput.placeholder = "Example: restaurant conversation, airport phrases, basic dog commands";
  freeTextInput.value = defaults.freeTextRequest || "";
  const freeTextField = createLabeledInput("Topic, need, or scenario", freeTextInput, {
    fullWidth: true,
  });
  const freeTextHelp = document.createElement("p");
  freeTextHelp.className = "app-modal__field-help";
  freeTextHelp.textContent = "Use this for original AI-generated content from scratch, not source extraction.";
  freeTextField.appendChild(freeTextHelp);
  freeTextField.hidden = true;
  freeTextInput.disabled = true;
  grid.appendChild(freeTextField);

  const sentenceLengthField = document.createElement("div");
  sentenceLengthField.className = "app-modal__field";
  const sentenceLengthLabel = document.createElement("span");
  sentenceLengthLabel.className = "app-modal__field-label";
  sentenceLengthLabel.textContent = "Sentence length";
  const sentenceLengthSelect = createSelectControl([
    { value: "short", label: "Short" },
    { value: "medium", label: "Medium" },
    { value: "long", label: "Long" },
  ], defaults.sentenceLength || "short");
  sentenceLengthField.append(sentenceLengthLabel, sentenceLengthSelect);
  sentenceLengthField.hidden = true;
  grid.appendChild(sentenceLengthField);

  const diacriticsField = document.createElement("label");
  diacriticsField.className = "app-modal__check-option app-modal__field--full";
  const diacriticsCheckbox = document.createElement("input");
  diacriticsCheckbox.type = "checkbox";
  diacriticsCheckbox.checked = defaults.includeDiacritics !== false;
  const diacriticsText = document.createElement("span");
  diacriticsText.textContent = "Include diacritics";
  diacriticsField.append(diacriticsCheckbox, diacriticsText);
  diacriticsField.hidden = true;
  grid.appendChild(diacriticsField);

  const manualSourceNote = document.createElement("p");
  manualSourceNote.className = "app-modal__generator-note";
  generator.appendChild(manualSourceNote);

  const formatRuleNote = document.createElement("p");
  formatRuleNote.className = "app-modal__generator-note";
  formatRuleNote.textContent = "Format rule: each output line must contain the learning-language content first, the user-language content second, and exactly one vertical bar separator between them.";
  generator.appendChild(formatRuleNote);

  const filePreview = document.createElement("p");
  filePreview.className = "app-modal__generator-file";
  generator.appendChild(filePreview);

  const warning = document.createElement("p");
  warning.className = "app-modal__generator-warning";
  warning.hidden = true;
  generator.appendChild(warning);

  const promptLabel = document.createElement("h4");
  promptLabel.className = "app-modal__subheading";
  promptLabel.textContent = "Generated prompt";
  generator.appendChild(promptLabel);

  const promptArea = document.createElement("textarea");
  promptArea.className = "app-modal__input app-modal__prompt";
  promptArea.readOnly = true;
  generator.appendChild(promptArea);

  const promptActions = document.createElement("div");
  promptActions.className = "app-modal__prompt-actions";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "button button-primary button-small";
  copyButton.textContent = "Copy prompt";
  promptActions.appendChild(copyButton);
  generator.appendChild(promptActions);

  const normalizeQuantityDisplay = () => {
    const parsed = Number.parseInt(quantityInput.value, 10);
    if (Number.isNaN(parsed)) {
      quantityInput.value = "10";
      return;
    }

    quantityInput.value = String(Math.min(30, Math.max(5, parsed)));
  };

  const updateGenerator = () => {
    const selectedOutputTypes = outputOptions
      .filter((option) => option.input.checked)
      .map((option) => option.input.value);
    const quantity = Number.parseInt(quantityInput.value, 10);
    const normalizedQuantity = Number.isNaN(quantity)
      ? 10
      : Math.min(30, Math.max(5, quantity));
    const sourceType = sourceTypeSelect.value;
    const textMode = textModeSelect.value;
    const learningLanguage = learningLanguageInput.value.trim();
    const userLanguage = userLanguageInput.value.trim();
    const freeTextRequest = freeTextInput.value.trim();
    const fileName = sanitizeFileBaseName(fileNameInput.value);
    const showSentenceLength = selectedOutputTypes.includes("full sentences");
    const showDiacriticsControl = supportsOptionalDiacritics(learningLanguage);
    const showTextMode = sourceType === "text";
    const showFreeText = sourceType === "free-text";

    sentenceLengthField.hidden = !showSentenceLength;
    diacriticsField.hidden = !showDiacriticsControl;
    textModeField.hidden = !showTextMode;
    freeTextField.hidden = !showFreeText;
    freeTextInput.disabled = !showFreeText;

    outputOptions.forEach((option) => {
      option.wrapper.classList.toggle("is-selected", option.input.checked);
    });

    manualSourceNote.textContent = sourceType === "text"
      ? "Text source: copy the prompt, then paste the source text directly into the AI tool. The app does not send the source automatically."
      : sourceType === "image"
        ? "Image source: copy the prompt, then upload the image directly in the AI tool. The app does not send the image automatically."
        : "Free text: enter a topic, need, or scenario. This creates new content from scratch, not from source extraction.";
    filePreview.textContent = `Output file: ${fileName}.txt`;

    const issues = [];
    const notices = [];
    if (!learningLanguage || !userLanguage) {
      issues.push("Add both language labels to generate the prompt.");
    }
    if (selectedOutputTypes.length === 0) {
      issues.push("Select at least one output type.");
    }
    if (showFreeText && !freeTextRequest) {
      issues.push("Add a topic, need, or scenario.");
    }
    if (selectedOutputTypes.length > 1 && normalizedQuantity <= 6) {
      notices.push("Small totals may reduce mix quality.");
    }

    warning.hidden = issues.length === 0 && notices.length === 0;
    warning.textContent = [...issues, ...notices].join(" ");

    const isValid = Boolean(
      learningLanguage
      && userLanguage
      && selectedOutputTypes.length > 0
      && (!showFreeText || freeTextRequest),
    );
    copyButton.disabled = !isValid;
    promptArea.value = isValid
      ? buildAiPromptText({
        fileName,
        sourceType,
        sourceTypeLabel: sourceTypeSelect.options[sourceTypeSelect.selectedIndex].text,
        textMode,
        textModeLabel: textModeSelect.options[textModeSelect.selectedIndex].text,
        learningLanguage,
        userLanguage,
        outputTypes: selectedOutputTypes,
        quantity: normalizedQuantity,
        difficulty: difficultySelect.value,
        sentenceLength: sentenceLengthSelect.value,
        showDiacriticsControl,
        includeDiacritics: diacriticsCheckbox.checked,
        freeTextRequest,
      })
      : "Complete the form to generate the prompt.";
  };

  [
    fileNameInput,
    sourceTypeSelect,
    textModeSelect,
    learningLanguageInput,
    userLanguageInput,
    freeTextInput,
    quantityInput,
    difficultySelect,
    sentenceLengthSelect,
    diacriticsCheckbox,
    ...outputOptions.map((option) => option.input),
  ].forEach((control) => {
    control.addEventListener("input", updateGenerator);
    control.addEventListener("change", updateGenerator);
  });

  quantityInput.addEventListener("blur", () => {
    normalizeQuantityDisplay();
    updateGenerator();
  });

  copyButton.addEventListener("click", async () => {
    if (copyButton.disabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(promptArea.value);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy prompt";
      }, 1400);
    } catch (error) {
      console.error("Clipboard write failed", error);
      copyButton.textContent = "Copy failed";
      window.setTimeout(() => {
        copyButton.textContent = "Copy prompt";
      }, 1600);
    }
  });

  updateGenerator();
  return generator;
}

function createAboutSection({ id, title, items = [], content = null }) {
  const section = document.createElement("section");
  section.className = "app-modal__section";
  section.id = id;

  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);

  if (items.length > 0) {
    const list = document.createElement("ul");
    items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.appendChild(listItem);
    });
    section.appendChild(list);
  }

  if (content) {
    section.appendChild(content);
  }

  return section;
}

function createAboutModal(options = {}) {
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
      title: "Generate AI Prompt",
      content: createAiPromptGenerator({
        fileBaseName: options.defaultFileBaseName || "",
        sourceType: "text",
        learningLanguage: options.defaultLearningLanguage || "",
        userLanguage: options.defaultUserLanguage || "",
        quantity: 10,
        difficulty: "beginner",
        sentenceLength: "short",
        includeDiacritics: true,
      }),
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

  about(options = {}) {
    return openCustomModal(() => createAboutModal(options));
  },
};
