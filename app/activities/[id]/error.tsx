"use client";

import Link from "next/link";

export default function ActivityError({ error }: { error: Error & { digest?: string } }) {
  return <main className="narrow-shell"><div className="error-state" role="alert"><h1>Activity could not be loaded.</h1><p>{error.message}</p><Link href="/dashboard" className="button">Back to dashboard</Link></div></main>;
}
