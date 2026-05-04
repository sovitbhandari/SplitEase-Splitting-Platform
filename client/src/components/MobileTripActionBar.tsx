type Props = {
  showSettleUp: boolean;
  onAddExpense: () => void;
  onSettleUp: () => void;
};

export function MobileTripActionBar({ showSettleUp, onAddExpense, onSettleUp }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm xl:hidden">
      <div className="mx-auto flex max-w-lg gap-3">
        <button
          type="button"
          onClick={onAddExpense}
          className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          aria-label="Add expense"
        >
          Add expense
        </button>
        {showSettleUp ? (
          <button
            type="button"
            onClick={onSettleUp}
            className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            aria-label="Settle up"
          >
            Settle up
          </button>
        ) : null}
      </div>
      <div className="h-[env(safe-area-inset-bottom)] shrink-0" aria-hidden />
    </div>
  );
}
