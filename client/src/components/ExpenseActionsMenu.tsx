import { useState } from 'react';

type Props = {
  onView: () => void;
  onDelete: () => void;
};

export function ExpenseActionsMenu({ onView, onDelete }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Expense actions"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        •••
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onView();
            }}
          >
            View details
          </button>
          <button
            type="button"
            disabled
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-400"
            title="Edit expense coming soon"
          >
            Edit expense
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete expense
          </button>
        </div>
      ) : null}
    </div>
  );
}
