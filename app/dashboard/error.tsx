"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-shell">
      <div className="error-state" role="alert">
        <h1>Students could not be loaded.</h1>
        <p>{error.message}</p>
        <button className="button" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
