"use client";

import { useActionState, useState } from "react";
import { searchResourceStudioAction } from "@/lib/resource-studio/search-actions";
import type { ResourceSearchItem, ResourceSearchResults, ResourceSearchState } from "@/lib/resource-studio/search-types";
import { ResourceStudioSelectedPreview } from "./resource-studio-selected-preview";
import styles from "./resource-studio-search.module.css";

export function ResourceSearchResultsView({ results, pending, error, onPreview }: {
  results?: ResourceSearchResults; pending: boolean; error?: string; onPreview?: (item: ResourceSearchItem) => void;
}) {
  if (pending) return <p role="status">Searching Resource Studio…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!results) return <p>Enter keywords or leave filters blank to browse published MCQs.</p>;
  if (!results.items.length) return <p role="status">No published MCQs match these filters. Try different keywords or clear a filter.</p>;
  return <>
    <p role="status">{results.total} {results.total === 1 ? "activity" : "activities"} found · Page {results.page} of {results.totalPages}</p>
    <ul className={styles.results}>
      {results.items.map(item => <li key={item.id}>
        <h3>{item.title || "Untitled activity"}</h3>
        <p>Multiple choice · {item.subject || "Subject unavailable"} · {item.yearGroup || "Year group unavailable"}</p>
        <p>Duration: not provided by Resource Studio</p>
        {item.objectiveTitle && <p><strong>Curriculum objective:</strong> {item.objectiveTitle}</p>}
        {item.tags.length > 0 && <p><strong>Tags:</strong> {item.tags.join(", ")}</p>}
        {onPreview && <button id={`resource-preview-${item.id}`} className="button button-small button-secondary" type="button"
          onClick={() => onPreview(item)} aria-label={`Preview ${item.title}, version ${item.contentVersion}`}>Preview activity</button>}
      </li>)}
    </ul>
  </>;
}

export function ResourceStudioSearch({ planId }: { planId: string }) {
  const [state, action, pending] = useActionState<ResourceSearchState, FormData>(searchResourceStudioAction.bind(null, planId), {});
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [fictional, setFictional] = useState(false);
  const [selected, setSelected] = useState<ResourceSearchItem | null>(null);
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
  // Edited filters start a fresh search; never paginate results from other filters.
  const results = fictional && state.query?.q === normalize(q) && state.query.subject === normalize(subject) &&
    state.query.yearGroup === normalize(yearGroup) ? state.results : undefined;

  return <section className={styles.search} aria-labelledby="resource-search-heading">
    <h2 id="resource-search-heading">Resource Studio library</h2>
    <p>Development only · Search and preview published multiple-choice activities for a fictional test student. Nothing is assigned here.</p>
    <form action={action} aria-busy={pending} hidden={Boolean(selected)}>
      <fieldset disabled={pending}>
        <legend>Search filters</legend>
        <div className={styles.filters}>
          <label>Keywords<input type="search" name="q" maxLength={120} value={q} onChange={event => setQ(event.target.value)} placeholder="e.g. equivalent fractions" /></label>
          <label>Subject<input name="subject" maxLength={80} value={subject} onChange={event => setSubject(event.target.value)} placeholder="e.g. Maths" /></label>
          <label>Year group<input name="yearGroup" maxLength={40} value={yearGroup} onChange={event => setYearGroup(event.target.value)} placeholder="e.g. Year 4" /></label>
        </div>
        <p className={styles.help}>Subject and year group match Resource Studio curriculum labels exactly. Enter topic keywords only; do not include names or personal information.</p>
        <label className={styles.confirm}><input type="checkbox" name="fictional" value="confirmed" required checked={fictional} onChange={event => setFictional(event.target.checked)} /> This is an existing fictional test student.</label>
        <button className="button button-small" type="submit" name="page" value="1">{pending ? "Searching…" : "Search library"}</button>
        <ResourceSearchResultsView results={results} pending={pending} error={state.error} onPreview={setSelected} />
        {!pending && results && results.totalPages > 1 && <nav className={styles.pagination} aria-label="Library search pages">
          <button className="button button-small button-secondary" type="submit" name="page" value={results.page - 1} disabled={results.page <= 1}>Previous page</button>
          <span>Page {results.page} of {results.totalPages}</span>
          <button className="button button-small button-secondary" type="submit" name="page" value={results.page + 1} disabled={results.page >= results.totalPages}>Next page</button>
        </nav>}
      </fieldset>
    </form>
    {selected && <ResourceStudioSelectedPreview key={`${planId}:${selected.id}:${selected.contentVersion}`} planId={planId}
      activityId={selected.id} version={selected.contentVersion} fictional={fictional} onClose={() => {
        const buttonId = `resource-preview-${selected.id}`;
        setSelected(null);
        requestAnimationFrame(() => document.getElementById(buttonId)?.focus());
      }} />}
  </section>;
}
