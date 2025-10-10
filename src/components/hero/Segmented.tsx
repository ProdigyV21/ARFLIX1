interface SegmentedProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export default function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div className="inline-flex bg-white/5 rounded-full p-1 gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-6 py-2 rounded-full text-sm font-semibold transition-all focus-glow ${
            value === option.value
              ? 'bg-[color:var(--accent)] text-black'
              : 'text-[color:var(--fg)] hover:bg-white/5'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
