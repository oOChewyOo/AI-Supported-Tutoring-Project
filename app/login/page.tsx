import { signInAction, signOutAction } from "@/lib/auth-actions";
import { getVerifiedSession } from "@/lib/auth";
import { redirect } from "next/navigation";

const messages: Record<string, string> = {
  credentials: "Sign-in failed. Check your email and password and try again.",
  access: "Tutor access is not enabled for this account. Ask your administrator to check your access and the database setup.",
  setup: "Supabase authentication is not configured. Ask your administrator to complete setup.",
  signout: "Sign-out could not be completed. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await getVerifiedSession();
  if (session) {
    const { data: tutor, error: tutorError } = await session.supabase
      .from("tutors").select("id").eq("id", session.user.id).eq("active", true).maybeSingle();
    // Keep a failed sign-out visible with a retry, rather than a redirect loop.
    if (tutor && !tutorError && error !== "signout") redirect("/dashboard");
    return <main className="narrow-shell">
      <div className="page-heading"><h1>{error === "signout" ? "Try signing out again" : "Tutor access unavailable"}</h1></div>
      <p role="alert">{error === "signout" ? messages.signout : messages.access}</p>
      <p>Sign out of this browser before using another account.</p>
      <form action={signOutAction}><button className="button" type="submit">Sign out</button></form>
    </main>;
  }
  return <main className="narrow-shell">
    <div className="page-heading"><span className="kicker">Practice Loop</span><h1>Tutor sign in</h1>
      <p>Use the account provided by your administrator.</p></div>
    {error && <p role="alert">{messages[error] ?? "Please try signing in again."}</p>}
    <form action={signInAction} className="auth-form">
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={320} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={4096} /></label>
      <button className="button" type="submit">Sign in</button>
    </form>
    <p>Accounts are provisioned by an administrator. Pupil accounts are not supported.</p>
  </main>;
}
