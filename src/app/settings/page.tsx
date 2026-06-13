import { SettingsView } from "@/features/settings/components/SettingsView";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const from = params.from === "money" ? "money" : "expenses";

  return <SettingsView from={from} />;
}
