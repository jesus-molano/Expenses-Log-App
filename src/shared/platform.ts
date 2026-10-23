type NavigatorLike = Pick<Navigator, "userAgent" | "maxTouchPoints">;

// iPhone, iPod o iPad (también el que se presenta como Mac con pantalla
// táctil). Ahí todos los navegadores son WebKit: sin dictado fiable e
// instalación con Compartir › Añadir a pantalla de inicio.
export function isAppleMobile(navigatorLike: NavigatorLike) {
  return (
    /iPad|iPhone|iPod/.test(navigatorLike.userAgent) ||
    (/Macintosh/.test(navigatorLike.userAgent) && navigatorLike.maxTouchPoints > 1)
  );
}

// Abierta como app instalada (desde la pantalla de inicio o como PWA de
// escritorio). Solo en el navegador.
export function isStandaloneDisplay() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
