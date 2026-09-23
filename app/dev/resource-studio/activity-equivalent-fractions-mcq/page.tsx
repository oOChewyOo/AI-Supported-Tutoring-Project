import { notFound } from "next/navigation";
import { fetchResourceActivity } from "@/lib/resource-studio/server";
import { ResourceStudioError } from "@/lib/resource-studio/activity";
import { ResourceStudioPreview } from "@/components/resource-studio-preview";

export const dynamic = "force-dynamic";

export default async function ResourceStudioPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  try {
    const activity = await fetchResourceActivity();
    return <main className="narrow-shell"><ResourceStudioPreview activity={activity} /></main>;
  } catch (error) {
    return <main className="narrow-shell"><h1>Activity preview unavailable</h1>
      <p role="alert">{error instanceof ResourceStudioError ? error.message : "The activity could not be loaded. Please try again."}</p>
      <a className="button" href="/dev/resource-studio/activity-equivalent-fractions-mcq">Try again</a>
    </main>;
  }
}
