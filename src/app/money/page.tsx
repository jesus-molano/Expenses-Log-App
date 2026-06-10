import { MoneyDashboard } from "@/components/MoneyDashboard";
import { getAppSession } from "@/features/auth/server/session";

export default async function MoneyPage() {
  const session = await getAppSession();
  return (
    <MoneyDashboard
      userEmail={session.userEmail}
      isCloudReady={session.isCloudReady}
    />
  );
}
