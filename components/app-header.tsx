import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getVerifiedSession, accessDestination } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";

export async function AppHeader() {
  const session = await getVerifiedSession();
  const destination = session ? await accessDestination(session) : null;
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark"><Sparkles size={17} strokeWidth={2.5} /></span>
        Practice Loop
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        {session ? <form action={signOutAction}>
          <button type="submit" className="button button-small button-secondary">Sign out</button>
        </form> : <Link href="/login">Tutor sign in</Link>}
        {destination === "/learn" ? <Link href="/learn">Your practice</Link> : <>
          <Link href="/dashboard" className="nav-dashboard">Tutor dashboard</Link>
          <Link href="/dashboard/students/new" className="button button-small nav-add-student">Add student</Link>
        </>}
      </nav>
    </header>
  );
}
