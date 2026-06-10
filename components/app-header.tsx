import Link from "next/link";
import { Sparkles } from "lucide-react";

export function AppHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark"><Sparkles size={17} strokeWidth={2.5} /></span>
        Practice Loop
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        <Link href="/dashboard">Tutor dashboard</Link>
        <Link href="/dashboard/students/new" className="button button-small">Add student</Link>
      </nav>
    </header>
  );
}
