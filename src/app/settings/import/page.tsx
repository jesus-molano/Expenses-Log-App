import { BankImportView } from "@/features/settings/components/BankImportView";

export default async function BankImportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const from = params.from === "money" ? "money" : "settings";

  return <BankImportView from={from} />;
}
