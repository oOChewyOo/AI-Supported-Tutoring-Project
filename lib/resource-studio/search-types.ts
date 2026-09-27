/** Public metadata only. Never add definitions, answers or source provenance here. */
export type ResourceSearchItem = {
  id: string;
  title: string;
  contentVersion: number;
  activityType: "multiple_choice";
  subject: string;
  yearGroup: string;
  objectiveId: string;
  objectiveTitle: string;
  tags: string[];
};

export type ResourceSearchQuery = {
  q: string;
  subject: string;
  yearGroup: string;
  page: number;
  pageSize: number;
};

export type ResourceSearchResults = {
  items: ResourceSearchItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ResourceSearchState = {
  error?: string;
  query?: ResourceSearchQuery;
  results?: ResourceSearchResults;
};
