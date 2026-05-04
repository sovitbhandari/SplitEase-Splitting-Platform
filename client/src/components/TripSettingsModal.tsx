import { useEffect, useState } from 'react';
import type { Group } from '../api/groups';

type Props = {
  group: Group;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: { name: string; description: string }) => Promise<void>;
};

export function TripSettingsModal({
  group,
  loading,
  error,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setName(group.name);
    setDescription(group.description ?? '');
    setLocalError(null);
  }, [group]);

  const submit = (): void => {
    void (async () => {
      const trimmed = name.trim();
      if (!trimmed) {
        setLocalError('Trip name is required.');
        return;
      }
      setLocalError(null);
      await onSave({ name: trimmed, description: description.trim() });
    })();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="trip-settings-title"
        aria-modal="true"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="trip-settings-title" className="text-lg font-semibold text-slate-900">
            Trip settings
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Update how this trip appears for everyone in the group.
          </p>
        </div>
        <div className="max-h-[calc(92vh-140px)] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="trip-name">
              Trip name <span className="text-rose-600">*</span>
            </label>
            <input
              id="trip-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              disabled={loading}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="trip-desc">
              Description
            </label>
            <textarea
              id="trip-desc"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Notes, destination ideas, or dates…"
              className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              disabled={loading}
            />
          </div>
          <p className="text-xs text-slate-500">
            Destination and trip dates can be added here as text until dedicated fields are
            supported.
          </p>
          {localError ? <p className="text-sm text-rose-600">{localError}</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            onClick={() => submit()}
            disabled={loading || !name.trim()}
            aria-busy={loading}
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
