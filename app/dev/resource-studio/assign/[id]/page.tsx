import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTutor } from "@/lib/auth";
import { ResourceStudioAssignmentForm } from "@/components/resource-studio-assignment-form";
import { getOwnedResourceSlot } from "@/lib/resource-studio/assignments";
import { ResourceStudioError } from "@/lib/resource-studio/activity";

export const dynamic = "force-dynamic";

export default async function AssignResourcePage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  await requireTutor();
  const { id } = await params;
  try {
    const slot = await getOwnedResourceSlot(id);
    return <main className="narrow-shell">
      <Link href={`/activities/${id}`} className="back-link">Back to activity</Link>
      <h1>Assign a Resource Studio exercise</h1>
      <p>{slot.student.name} · {slot.plan.title} · Session {slot.session.session_number} · {slot.activity.title}</p>
      {slot.activity.resource_studio_assigned ? <p>This slot already has an imported snapshot.</p>
        : slot.activity.content_json !== null || slot.activity.template_id !== null ? <p>Choose an unused placeholder instead.</p>
          : <ResourceStudioAssignmentForm activityId={id} />}
    </main>;
  } catch (error) {
    return <main className="narrow-shell"><h1>Assignment unavailable</h1><p role="alert">{error instanceof ResourceStudioError ? error.message : "Could not load this activity."}</p></main>;
  }
}
