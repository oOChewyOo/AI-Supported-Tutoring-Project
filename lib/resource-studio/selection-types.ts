/** Tutor planning metadata only. Never contains an activity definition or answers. */
export type ResourceSessionSelection = {
  id: string;
  weekly_session_id: string;
  source_activity_id: string;
  source_version: number;
  title: string;
  activity_type: "multiple_choice";
  selected_by: string;
  selected_at: string;
};

export type ResourceSelectionState = {
  selections?: ResourceSessionSelection[];
  error?: string;
  unavailable?: boolean;
};
