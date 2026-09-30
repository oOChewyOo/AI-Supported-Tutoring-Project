"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ResourceActivity } from "@/lib/resource-studio/activity";
import { previewResourceStudioAction } from "@/lib/resource-studio/preview-actions";
import type { ResourcePreviewState } from "@/lib/resource-studio/preview-types";
import { ResourceStudioPreview } from "./resource-studio-preview";
import previewStyles from "./resource-studio-preview.module.css";

/** Mounted only after an explicit tutor selection, outside the search form. */
export function ResourceStudioSelectedPreview({ planId, activityId, version, fictional, onClose, selectionControls }: {
  planId: string; activityId: string; version: number; fictional: boolean; onClose: () => void;
  selectionControls?: (activity: ResourceActivity) => ReactNode;
}) {
  const [state, setState] = useState<ResourcePreviewState | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    heading.current?.focus();
    previewResourceStudioAction(planId, activityId, version, fictional).then(
      result => { if (active) setState(result); },
      () => { if (active) setState({ error: "Could not load the preview. Return to the results and try again." }); },
    );
    // Closing or switching previews must discard late responses and answer data.
    return () => { active = false; };
  }, [planId, activityId, version, fictional]);

  return <section className={previewStyles.previewBoundary} aria-labelledby="selected-resource-preview-heading" aria-busy={!state}>
    <h2 id="selected-resource-preview-heading" tabIndex={-1} ref={heading}>Tutor activity preview</h2>
    <button type="button" className="button button-small button-secondary" onClick={onClose}>Back to search results</button>
    <p>Published version {version} · {selectionControls ? "Checking answers stays local. Adding to a session saves a planning reference only." : "Preview only. Nothing is assigned or saved."}</p>
    {!state ? <p role="status">Loading the selected published version…</p>
      : state.error ? <div role="alert"><h3>{state.unavailable ? "Publication unavailable" : "Preview unavailable"}</h3><p>{state.error}</p></div>
        : state.activity ? <>{selectionControls?.(state.activity)}<ResourceStudioPreview key={`${activityId}:${version}`} activity={state.activity} embedded /></> : null}
  </section>;
}
