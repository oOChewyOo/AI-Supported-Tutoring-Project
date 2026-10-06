export type SessionPackageAssignment = {
  id: string; batchId: string; proposalId: string; sessionId: string; position: number;
  activityType: string; purpose: string; dose: string; estimatedMinutes: number;
  status: "assigned"; approvedAt: string;
};
export type AssignmentState = { assignments?: SessionPackageAssignment[]; error?: string };
