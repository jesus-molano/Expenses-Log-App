// Estado de los primeros pasos en este dispositivo (no se sincroniza): si el
// usuario empezó aquí con la app vacía y si ya los ocultó.
const ONBOARDING_KEY = "expense-onboarding-v1";

export type OnboardingState = {
  startedAt?: string;
  dismissedAt?: string;
};

export function readOnboardingState(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const { startedAt, dismissedAt } = parsed as Record<string, unknown>;
    return {
      ...(typeof startedAt === "string" ? { startedAt } : {}),
      ...(typeof dismissedAt === "string" ? { dismissedAt } : {}),
    };
  } catch {
    return {};
  }
}

export function writeOnboardingState(state: OnboardingState) {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch {
    // Sin localStorage la guía se basa solo en si hay gastos.
  }
}
