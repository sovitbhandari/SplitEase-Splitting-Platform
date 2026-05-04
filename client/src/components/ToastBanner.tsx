import { useEffect } from 'react';

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function ToastBanner({ message, onDismiss, durationMs = 3200 }: Props) {
  useEffect(() => {
    if (!message) {
      return;
    }
    const id = window.setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 px-3">
      <div className="pointer-events-auto rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
