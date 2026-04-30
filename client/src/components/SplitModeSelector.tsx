type Mode = 'equal' | 'percentage' | 'exact';

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
  helperText?: string;
};

export function SplitModeSelector({ mode, onChange, helperText }: Props) {
  const modes: Mode[] = ['equal', 'percentage', 'exact'];
  return (
    <div>
      <div className="flex gap-2">
        {modes.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded px-3 py-1.5 text-sm ${
              mode === item
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 text-slate-700'
            }`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {helperText ? <p className="mt-2 text-xs text-rose-600">{helperText}</p> : null}
    </div>
  );
}
