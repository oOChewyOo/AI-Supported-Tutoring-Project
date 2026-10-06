import { requireLearner } from "@/lib/auth";
export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  await requireLearner();
  return <>{children}</>;
}
