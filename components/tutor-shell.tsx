import { requireTutor } from "@/lib/auth";

export async function TutorShell({ children }: { children: React.ReactNode }) {
  await requireTutor();
  return <>{children}</>;
}
