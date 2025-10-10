interface ArflixLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

export default function ArflixLogo({ className = '', size = 'md', compact = false }: ArflixLogoProps) {
  const sizeMap = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 32, text: 'text-2xl' },
    lg: { icon: 40, text: 'text-3xl' }
  };

  const { icon, text } = sizeMap[size];

  if (compact) {
    return (
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        aria-label="ARFLIX"
        className={`shrink-0 ${className}`}
      >
        <path
          d="M14.5 2 4 13.2h6.3L9.5 22 20 10.8h-6.3L14.5 2Z"
          fill="url(#arflix-gradient)"
          stroke="none"
        />
        <defs>
          <linearGradient id="arflix-gradient" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0" stopColor="#12D8FF"/>
            <stop offset="1" stopColor="#0EA5E9"/>
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        aria-label="ARFLIX"
        className="shrink-0"
      >
        <path
          d="M14.5 2 4 13.2h6.3L9.5 22 20 10.8h-6.3L14.5 2Z"
          fill="url(#arflix-gradient-full)"
          stroke="none"
        />
        <defs>
          <linearGradient id="arflix-gradient-full" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0" stopColor="#12D8FF"/>
            <stop offset="1" stopColor="#0EA5E9"/>
          </linearGradient>
        </defs>
      </svg>

      <span
        className={`select-none font-black ${text} tracking-tight`}
        style={{
          fontFamily: 'Urbanist, "Inter Tight", system-ui',
          fontWeight: 900,
          letterSpacing: '-0.03em'
        }}
      >
        ARFLIX
      </span>
    </div>
  );
}
