// Applied before first paint (blocking <head> script) so the chosen
// theme never flashes. Stored choice wins; otherwise fall back to the
// OS preference. Sets the `.dark` class on <html> when appropriate.
(function () {
  try {
    var stored = localStorage.getItem("soloos.theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
