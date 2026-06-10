import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LessonReflectionForm } from "@/components/lesson-reflection-form";
import { getStudent } from "@/lib/data";

export default async function NewLessonReflectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) notFound();

  return (
    <main className="narrow-shell">
      <Link href={`/students/${student.id}`} className="back-link"><ArrowLeft size={15} /> Back to {student.name}</Link>
      <div className="page-heading">
        <span className="kicker">Lesson reflection</span>
        <h1>Reflect on {student.name}&apos;s lesson.</h1>
        <p>Capture the useful details while the session is still fresh.</p>
      </div>
      <LessonReflectionForm studentId={student.id} />
    </main>
  );
}
