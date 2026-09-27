import type { ResourceActivity } from "./activity";

/** Answer-bearing data for the authenticated tutor development preview only. */
export type ResourcePreviewState =
  | { activity: ResourceActivity; error?: never; unavailable?: never }
  | { activity?: never; error: string; unavailable?: boolean };
