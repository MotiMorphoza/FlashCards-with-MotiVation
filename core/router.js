import { EventBus } from "./eventBus.js";

export class Router {
  constructor() {
    this.currentScreen = null;
    this.history = [];
    this.screens = new Map();
  }

  register(name, element) {
    if (!element) {
      throw new Error(`Router cannot register missing screen "${name}"`);
    }

    this.screens.set(name, element);
  }

  navigate(name, options = {}) {
    const { record = true } = options;

    if (!this.screens.has(name)) {
      console.error(`Router screen "${name}" was not registered`);
      return false;
    }

    this.screens.forEach((element, screenName) => {
      element.classList.toggle("active", screenName === name);
    });

    if (record && this.currentScreen && this.currentScreen !== name) {
      this.history.push(this.currentScreen);
    }

    this.currentScreen = name;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    EventBus.emit("route:change", { name });

    return true;
  }

  back() {
    if (this.history.length === 0) {
      return this.navigate("home", { record: false });
    }

    const previous = this.history.pop();
    return this.navigate(previous, { record: false });
  }

  clearHistory() {
    this.history.length = 0;
  }
}
