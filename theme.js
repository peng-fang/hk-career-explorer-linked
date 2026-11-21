(() => {
  "use strict";

  const storageKey = "hk-guide-linked-theme";
  const isSupported = t => t === "light" || t === "dark";
  function readPreference() {
    try { return localStorage.getItem(storageKey); }
    catch { return null; }
  }

  const shared = new URLSearchParams(location.search).get("theme");
  const preference = readPreference();
  let theme = isSupported(shared) ? shared : isSupported(preference) ? preference : "light";

  function apply() {
    document.documentElement.dataset.theme = theme;
  }

  function set(next) {
    if (!isSupported(next)) return;
    theme = next;
    try { localStorage.setItem(storageKey, next); }
    catch { /* The current tab can still switch themes. */ }
    apply();
    const url = new URL(location.href);
    if (url.searchParams.has("theme")) {
      url.searchParams.set("theme", next);
      history.replaceState(history.state, "", url);
    }
  }

  function toggle() { set(theme === "dark" ? "light" : "dark"); }

  apply();
  globalThis.guideTheme = { get: () => theme, set, toggle, isDark: () => theme === "dark" };
})();
