import "server-only";
import { randomUUID } from "node:crypto";
import type { PracticeProposal } from "./proposal-contract";

type Entry = { tutorId: string; planId: string; proposal: PracticeProposal; expires: number };
const globals = globalThis as typeof globalThis & { practiceLoopProposals?: Map<string, Entry>; practiceLoopProposalBusy?: Set<string> };
const entries = globals.practiceLoopProposals ??= new Map<string, Entry>();
export const proposalBusy = globals.practiceLoopProposalBusy ??= new Set<string>();
export function retainProposal(tutorId: string, planId: string, proposal: PracticeProposal) {
  for (const [id, value] of entries) if (value.expires <= Date.now()) entries.delete(id);
  while (entries.size >= 100) entries.delete(entries.keys().next().value!);
  const id = randomUUID();
  entries.set(id, { tutorId, planId, proposal, expires: Math.min(Date.parse(proposal.expiresAt), Date.now() + 30 * 60_000) });
  return { ...proposal, id, activities: proposal.activities.map(({ previewToken, ...activity }) => ({ ...activity, previewAvailable: Boolean(previewToken) })) };
}
export function retainedProposal(id: string, tutorId: string, planId: string) {
  const entry = entries.get(id);
  return entry && entry.expires > Date.now() && entry.tutorId === tutorId && entry.planId === planId ? entry.proposal : undefined;
}
export type TutorProposal = ReturnType<typeof retainProposal>;
