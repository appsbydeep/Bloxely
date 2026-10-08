import { useState } from 'react';
import type { WorkspacePlan } from '../types/workspace';
import { isValidTaskSuggestion, MAX_ESTIMATED_MINUTES, MIN_ESTIMATED_MINUTES, TASK_PRIORITIES } from '../utils/workspaceTaskValidation';

interface WorkspacePlanReviewProps {
  plan: WorkspacePlan;
  onChange: (plan: WorkspacePlan) => void;
  onBack: () => void;
  onConfirm: () => void;
  error: string | null;
}

export default function WorkspacePlanReview({ plan, onChange, onBack, onConfirm, error }: WorkspacePlanReviewProps) {
  const [estimateDrafts, setEstimateDrafts] = useState<Record<string, string>>({});
  const [editedTaskIds, setEditedTaskIds] = useState<Record<string, boolean>>({});
  const markEdited = (id: string) => setEditedTaskIds(current => ({ ...current, [id]: true }));
  const updateTask = (id: string, change: Partial<WorkspacePlan['proposedTasks'][number]>) => {
    markEdited(id);
    onChange({ ...plan, proposedTasks: plan.proposedTasks.map(task => task.id === id ? { ...task, ...change } : task) });
  };
  const setTaskTitle = (id: string, title: string) => updateTask(id, { title });
  const removeTask = (id: string) => onChange({
    ...plan,
    proposedTasks: plan.proposedTasks.filter(task => task.id !== id),
    proposedBlocks: plan.proposedBlocks.map(block => block.type === 'todo'
      ? { ...block, taskIds: block.taskIds?.filter(taskId => taskId !== id) } : block),
  });
  const setNoteContent = (id: string, content: string) => onChange({
    ...plan, proposedNotes: plan.proposedNotes.map(note => note.id === id ? { ...note, content } : note),
  });
  const removeNote = (id: string) => onChange({
    ...plan,
    proposedNotes: plan.proposedNotes.filter(note => note.id !== id),
    proposedBlocks: plan.proposedBlocks.filter(block => block.noteId !== id),
  });
  const setDueAt = (id: string, date: string, time: string) => {
    if (!date) {
      markEdited(id);
      onChange({ ...plan, proposedTasks: plan.proposedTasks.map(task => {
        if (task.id !== id) return task;
        const rest = { ...task };
        delete rest.dueAt;
        return rest;
      }) });
      return;
    }
    const dueAt = time ? new Date(`${date}T${time}:00`).toISOString() : date;
    updateTask(id, { dueAt });
  };
  const setEstimate = (id: string, raw: string) => {
    setEstimateDrafts(current => ({ ...current, [id]: raw }));
    const value = Number(raw);
    if (raw !== '' && (!Number.isInteger(value) || value < MIN_ESTIMATED_MINUTES || value > MAX_ESTIMATED_MINUTES)) return;
    markEdited(id);
    onChange({ ...plan, proposedTasks: plan.proposedTasks.map(task => {
      if (task.id !== id) return task;
      if (raw === '') {
        const rest = { ...task };
        delete rest.estimatedMinutes;
        return rest;
      }
      return { ...task, estimatedMinutes: value };
    }) });
  };
  const hasInvalidEstimate = plan.proposedTasks.some(task => {
    const raw = estimateDrafts[task.id];
    return raw !== undefined && raw !== '' &&
      (!Number.isInteger(Number(raw)) || Number(raw) < MIN_ESTIMATED_MINUTES || Number(raw) > MAX_ESTIMATED_MINUTES);
  });
  const canConfirm = plan.proposedTasks.length + plan.proposedNotes.length > 0 &&
    !hasInvalidEstimate && plan.proposedTasks.every(task => task.title.trim() && isValidTaskSuggestion(task)) &&
    plan.proposedNotes.every(note => note.content.trim());

  return (
    <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <p className="mb-2 text-sm font-semibold tracking-widest text-indigo-600 dark:text-indigo-300">WORKSPACE PLAN</p>
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Review your plan</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Review and edit this draft before building your workspace.</p>

      <div className="mt-8 space-y-8">
        <section aria-labelledby="plan-tasks">
          <h3 id="plan-tasks" className="mb-3 text-xl font-semibold">Tasks</h3>
          <div className="space-y-3">
            {plan.proposedTasks.length === 0 && <p className="text-slate-500">No tasks in this plan.</p>}
            {plan.proposedTasks.map((task, index) => (
              <div key={task.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Task {index + 1} · {editedTaskIds[task.id] ? 'Edited by you' : 'Suggested details'}</p>
                <div className="flex flex-wrap gap-3">
                  <label className="sr-only" htmlFor={`task-${task.id}`}>Task {index + 1}</label>
                  <input id={`task-${task.id}`} value={task.title} onChange={event => setTaskTitle(task.id, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                  <button type="button" onClick={() => removeTask(task.id)} aria-label={`Remove task ${index + 1}`} className="rounded-lg border border-slate-300 px-4 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">Remove</button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <label className="text-sm">Priority
                    <select aria-label={`Priority for task ${index + 1}`} value={task.priority} onChange={event => updateTask(task.id, { priority: event.target.value as typeof task.priority })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                      {TASK_PRIORITIES.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </label>
                  {(() => {
                    const due = task.dueAt?.includes('T') ? new Date(task.dueAt) : null;
                    const date = due ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}` : task.dueAt || '';
                    const time = due ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : '';
                    return <>
                      <label className="text-sm">Due date (optional)
                        <input aria-label={`Due date for task ${index + 1}`} type="date" value={date} onChange={event => setDueAt(task.id, event.target.value, time)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="text-sm">Due time (optional)
                        <input aria-label={`Due time for task ${index + 1}`} type="time" value={time} disabled={!date} onChange={event => setDueAt(task.id, date, event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white disabled:opacity-50" />
                      </label>
                    </>;
                  })()}
                  <label className="text-sm">Estimate in minutes (optional)
                    <input aria-label={`Estimate for task ${index + 1}`} type="number" min={MIN_ESTIMATED_MINUTES} max={MAX_ESTIMATED_MINUTES} step="1" value={estimateDrafts[task.id] ?? task.estimatedMinutes ?? ''} onChange={event => setEstimate(task.id, event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                  </label>
                </div>
                {estimateDrafts[task.id] !== undefined && estimateDrafts[task.id] !== '' &&
                  (!Number.isInteger(Number(estimateDrafts[task.id])) || Number(estimateDrafts[task.id]) < MIN_ESTIMATED_MINUTES || Number(estimateDrafts[task.id]) > MAX_ESTIMATED_MINUTES) &&
                  <p role="alert" className="mt-2 text-sm text-red-600">Use a whole number from 5 to 480 minutes.</p>}
              </div>
            ))}
          </div>
        </section>
        {plan.unresolvedItems.length > 0 && <section aria-labelledby="plan-unresolved"><h3 id="plan-unresolved" className="mb-3 text-xl font-semibold">Needs clarification</h3><ul className="list-disc pl-5 text-slate-700 dark:text-slate-200">{plan.unresolvedItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
        <section aria-labelledby="plan-notes">
          <h3 id="plan-notes" className="mb-3 text-xl font-semibold">Notes</h3>
          <div className="space-y-3">
            {plan.proposedNotes.length === 0 && <p className="text-slate-500">No notes in this plan.</p>}
            {plan.proposedNotes.map((note, index) => (
              <div key={note.id} className="flex gap-3">
                <label className="sr-only" htmlFor={`note-${note.id}`}>Note {index + 1}</label>
                <textarea id={`note-${note.id}`} rows={4} value={note.content} onChange={event => setNoteContent(note.id, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                <button type="button" onClick={() => removeNote(note.id)} aria-label={`Remove note ${index + 1}`} className="self-start rounded-lg border border-slate-300 px-4 py-3 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">Remove</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {error && <p role="alert" className="mt-6 text-red-600">{error}</p>}
      <div className="mt-10 flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-3 font-medium hover:bg-slate-100 dark:hover:bg-slate-700">Back</button>
        <button type="button" onClick={onConfirm} disabled={!canConfirm} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">Build workspace</button>
      </div>
    </section>
  );
}
