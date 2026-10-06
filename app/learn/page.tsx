import Link from "next/link";
import { learnerPractice } from "@/lib/learner-practice";
export default async function LearnerHome() {
  const plans = await learnerPractice();
  return <main className="page-shell"><h1>Your practice</h1>
    {!plans.length && <p>No practice is assigned yet.</p>}
    {plans.map(plan => <section key={plan.id}><h2>{plan.title}</h2><ul>
      {plan.sessions.map(session => <li key={session.id}><Link href={`/learn/${plan.id}/${session.id}`}>
        Session {session.number}: {session.title}</Link> — {session.assignments.length} assigned activities</li>)}
    </ul></section>)}
  </main>;
}
