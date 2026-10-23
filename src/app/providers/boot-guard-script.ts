// Se ejecuta antes que el JavaScript de la app y sin depender de él:
// - aplica idioma y tema guardados en cookies para que la pantalla de carga
//   no parpadee;
// - apunta los recursos que no cargan para mostrarlos en la pantalla de carga;
// - con `?sw-reset=1` y conexión, desregistra el service worker y borra sus
//   cachés (nunca localStorage) para reparar una instalación atascada.
export const BOOT_GUARD_SCRIPT = `(function () {
  var root = document.documentElement;
  try {
    document.cookie.split("; ").forEach(function (cookie) {
      var parts = cookie.split("=");
      if (parts[0] === "expense-language" && (parts[1] === "es" || parts[1] === "en")) {
        root.lang = parts[1];
      }
      if (parts[0] === "expense-theme" && /^[a-z-]+$/.test(parts[1] || "")) {
        root.setAttribute("data-theme", parts[1]);
      }
    });
  } catch (error) {}

  var failed = (window.__bootErrors = []);
  function render() {
    var output = document.querySelector("[data-boot-diagnostics]");
    if (output && failed.length) output.textContent = failed.slice(-3).join("\\n");
  }
  window.addEventListener("error", function (event) {
    var target = event.target;
    var source = target && target !== window && (target.src || target.href);
    if (!source) return;
    failed.push(String(source).replace(location.origin, ""));
    render();
  }, true);
  document.addEventListener("DOMContentLoaded", render);

  try {
    if (new URLSearchParams(location.search).get("sw-reset") === "1" && navigator.onLine) {
      var done = function () { location.replace("/"); };
      Promise.all([
        navigator.serviceWorker
          ? navigator.serviceWorker.getRegistrations().then(function (registrations) {
              return Promise.all(registrations.map(function (registration) {
                return registration.unregister();
              }));
            })
          : null,
        window.caches
          ? caches.keys().then(function (keys) {
              return Promise.all(keys.map(function (key) { return caches.delete(key); }));
            })
          : null,
      ]).then(done, done);
    }
  } catch (error) {}
})();`;
