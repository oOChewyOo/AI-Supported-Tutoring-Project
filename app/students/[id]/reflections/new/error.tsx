"use client";

import Link from "next/link";

export default function NewReflectionError({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="narrow-shell">
      <div className="error-state" role="alert">
        <h1>Reflection form could not be loaded.</h1>
        <p>{error.message}</p>
        <Link href="/dashboard" className="button">Back to students</Link>
      </div>
    </main>
  );
}
