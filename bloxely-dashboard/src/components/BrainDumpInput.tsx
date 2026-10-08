import type { FormEvent } from 'react';

interface BrainDumpInputProps {
  value: string;
  onChange: (value: string) => void;
  onBuild: () => void;
  loading?: boolean;
}

export default function BrainDumpInput({ value, onChange, onBuild, loading = false }: BrainDumpInputProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onBuild();
  };

  return (
    <section className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <p className="mb-3 text-sm font-semibold tracking-widest text-indigo-600 dark:text-indigo-300">BLOXELY AI</p>
      <h2 className="mb-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">What's on your mind?</h2>
      <p className="mb-8 text-lg text-slate-600 dark:text-slate-300">
        Add tasks, deadlines, notes, projects, or anything you need to deal with.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="brain-dump" className="sr-only">Brain dump</label>
        <textarea
          id="brain-dump"
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={loading}
          placeholder="Finish homepage today. Send Sarah the proposal before lunch. Client call at 2..."
          rows={8}
          className="w-full resize-y rounded-2xl border border-slate-300 bg-white p-5 text-lg text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        <div className="mt-5 flex justify-end">
          <button type="submit" disabled={!value.trim() || loading} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Understanding your work…' : 'Build my workspace'}
          </button>
        </div>
        {loading && <p role="status" className="mt-4 text-center text-slate-600 dark:text-slate-300"><span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" aria-hidden="true" />Understanding your work…</p>}
      </form>
    </section>
  );
}
