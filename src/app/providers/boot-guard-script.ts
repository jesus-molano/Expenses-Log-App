import { THEME_COLORS } from "@/shared/theme";

// Se ejecuta al parsear el <head>, sin depender del JavaScript de la app.
// Next coloca antes sus preloads, CSS y chunks; los fallos previos al script
// se recuperan de performance al cargar el documento. El script:
// - aplica idioma y tema guardados en cookies para que la pantalla de carga
//   no parpadee, también en la barra del sistema (`theme-color`);
// - lista los recursos de /_next/static que no cargan en la pantalla de carga;
// - a los 6 s, si la app sigue sin abrir, anuncia la ayuda a lectores de
//   pantalla;
// - con `?sw-reset=1` y red real, desregistra el service worker y borra sus
//   cachés (nunca localStorage) para reparar una instalación atascada.
export const BOOT_GUARD_SCRIPT = `(function () {
  var root = document.documentElement;
  var themeColors = ${JSON.stringify(THEME_COLORS)};
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
  // La meta del layout llega después de este script: se ajusta al cargar.
  document.addEventListener("DOMContentLoaded", function () {
    var color = themeColors[root.getAttribute("data-theme") || ""];
    if (!color) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute("content", color);
    });
  });

  var failed = (window.__bootErrors = []);
  function record(source) {
    var path = String(source).replace(location.origin, "");
    if (path.indexOf("/_next/static/") === -1 || failed.indexOf(path) !== -1) return;
    failed.push(path);
    render();
  }
  function render() {
    var output = document.querySelector("[data-boot-diagnostics]");
    if (output && failed.length) output.textContent = failed.slice(-3).join("\\n");
  }
  window.addEventListener("error", function (event) {
    var target = event.target;
    var source = target && target !== window && (target.src || target.href);
    if (source) record(source);
  }, true);
  document.addEventListener("DOMContentLoaded", function () {
    try {
      performance.getEntriesByType("resource").forEach(function (entry) {
        if (entry.decodedBodySize === 0 && entry.responseStatus !== 304) record(entry.name);
      });
    } catch (error) {}
    render();
  });

  setTimeout(function () {
    if (!document.querySelector(".app-boot-shell")) return;
    var help = document.querySelector('.app-boot-text[lang="' + (root.lang === "en" ? "en" : "es") + '"] [data-boot-help]');
    var status = document.querySelector("[data-boot-status]");
    if (help && status) status.textContent = help.textContent;
  }, 6000);

  try {
    if (new URLSearchParams(location.search).get("sw-reset") === "1") {
      var stop = function () { history.replaceState(null, "", "/"); };
      var reset = function () {
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
        ]).then(function () { location.replace("/"); }, stop);
      };
      // navigator.onLine miente con redes sin salida: se confirma con una
      // petición real que el service worker no puede servir desde caché.
      fetch("/manifest.webmanifest?sw-reset-probe=" + Date.now(), { cache: "no-store" })
        .then(function (response) { if (response.ok) reset(); else stop(); }, stop);
    }
  } catch (error) {}
})();`;
