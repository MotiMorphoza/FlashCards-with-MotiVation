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
};
