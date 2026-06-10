"use client";

import Link from "next/link";

export default function WeeklyPlanError({ error }: { error: Error & { digest?: string } }) {
  return <main className="page-shell"><div className="error-state" role="alert"><h1>Weekly plan could not be loaded.</h1><p>{error.message}</p><Link href="/dashboard" className="button">Back to dashboard</Link></div></main>;
}
