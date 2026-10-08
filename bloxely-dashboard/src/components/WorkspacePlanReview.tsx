import type { WorkspacePlan } from '../types/workspace';

interface WorkspacePlanReviewProps {
  plan: WorkspacePlan;
  onChange: (plan: WorkspacePlan) => void;
  onBack: () => void;
  onConfirm: () => void;
  error: string | null;
}

export default function WorkspacePlanReview({ plan, onChange, onBack, onConfirm, error }: WorkspacePlanReviewProps) {
  const setTaskTitle = (id: string, title: string) => onChange({
    ...plan, proposedTasks: plan.proposedTasks.map(task => task.id === id ? { ...task, title } : task),
  });
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
  const canConfirm = plan.proposedTasks.length + plan.proposedNotes.length > 0 &&
    plan.proposedTasks.every(task => task.title.trim()) && plan.proposedNotes.every(note => note.content.trim());

  return (
    <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <p className="mb-2 text-sm font-semibold tracking-widest text-indigo-600 dark:text-indigo-300">WORKSPACE PLAN</p>
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Review your plan</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-300">This is a simple local draft. Edit it before building your workspace.</p>

      <div className="mt-8 space-y-8">
        <section aria-labelledby="plan-tasks">
          <h3 id="plan-tasks" className="mb-3 text-xl font-semibold">Tasks</h3>
          <div className="space-y-3">
            {plan.proposedTasks.length === 0 && <p className="text-slate-500">No tasks in this plan.</p>}
            {plan.proposedTasks.map((task, index) => (
              <div key={task.id} className="flex gap-3">
                <label className="sr-only" htmlFor={`task-${task.id}`}>Task {index + 1}</label>
                <input id={`task-${task.id}`} value={task.title} onChange={event => setTaskTitle(task.id, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                <button type="button" onClick={() => removeTask(task.id)} aria-label={`Remove task ${index + 1}`} className="rounded-lg border border-slate-300 px-4 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">Remove</button>
              </div>
            ))}
          </div>
        </section>
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
