import { ExpenseDashboard } from "@/components/ExpenseDashboard";
import { getAppSession } from "@/features/auth/server/session";

export default async function Home() {
  const session = await getAppSession();
  return (
    <ExpenseDashboard
      userEmail={session.userEmail}
      isCloudReady={session.isCloudReady}
    />
  );
}
