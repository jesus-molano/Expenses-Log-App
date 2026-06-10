import { ExpenseDashboard } from "@/components/ExpenseDashboard";
import { getAppSession } from "@/features/auth/server/session";

export default async function NewExpensePage() {
  const session = await getAppSession();
  return (
    <ExpenseDashboard
      initialNewExpense
      userEmail={session.userEmail}
      isCloudReady={session.isCloudReady}
    />
  );
}
