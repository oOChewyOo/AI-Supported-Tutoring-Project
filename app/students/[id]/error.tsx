"use client";

import Link from "next/link";

export default function StudentError({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="page-shell">
      <div className="error-state" role="alert">
        <h1>Student profile could not be loaded.</h1>
        <p>{error.message}</p>
        <Link href="/dashboard" className="button">Back to students</Link>
      </div>
    </main>
  );
}
