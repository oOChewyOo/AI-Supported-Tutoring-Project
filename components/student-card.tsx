import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Student } from "@/lib/types";

export function StudentCard({ student }: { student: Student }) {
  return (
    <article className="student-card">
      <div className="student-card-top">
        <div className="avatar">{student.name.split(" ").map((part) => part[0]).join("")}</div>
        <div>
          <h3>{student.name}</h3>
          <p>{student.yearGroup} · {student.subjectFocus}</p>
        </div>
      </div>
      <div className="student-card-detail">
        <span>Next focus</span>
        <strong>{student.needsPractice[0] ?? "Not set yet"}</strong>
      </div>
      <div className="student-card-actions">
        <Link href={`/students/${student.id}`}>View profile <ArrowUpRight size={15} /></Link>
      </div>
    </article>
  );
}
