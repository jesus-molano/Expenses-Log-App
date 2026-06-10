import { ExpenseDetail } from "@/components/ExpenseDetail";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExpenseDetail id={id} />;
}
