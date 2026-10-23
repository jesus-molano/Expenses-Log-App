import { Suspense } from "react";
import { SettingsView } from "@/features/settings/components/SettingsView";

// Página estática: `from` se lee en cliente para que /settings entre en el
// precache y /settings?from=money abra sin conexión.
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
