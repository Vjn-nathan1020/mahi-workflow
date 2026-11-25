// Small MAHI head used on the sign-in screens (the full animated character lives in the app).
export default function MahiFace({ size = 120 }) {
  return (
    <svg className="mahi-float" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="MAHI">
      <defs>
        <linearGradient id="lh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#d3dde1" /></linearGradient>
        <linearGradient id="lv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16294a" /><stop offset="1" stopColor="#060f22" /></linearGradient>
      </defs>
      <rect x="12" y="44" width="10" height="30" rx="5" fill="#1B5E20" />
      <rect x="98" y="44" width="10" height="30" rx="5" fill="#1B5E20" />
      <path d="M60 18c32 0 42 18 42 40 0 26-17 38-42 38S18 84 18 58c0-22 10-40 42-40z" fill="url(#lh)" stroke="#c4d0d4" />
      <path d="M60 32c26 0 32 13 32 28 0 18-12 26-32 26S28 78 28 60c0-15 6-28 32-28z" fill="url(#lv)" />
      <rect className="mahi-eye" x="42" y="50" width="12" height="18" rx="6" fill="#5CF5C8" />
      <rect className="mahi-eye" x="66" y="50" width="12" height="18" rx="6" fill="#5CF5C8" />
      <path d="M52 76 Q60 82 68 76" stroke="#5CF5C8" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="34" y="72" width="7" height="3" rx="1.5" fill="#FF8FB1" />
      <rect x="79" y="72" width="7" height="3" rx="1.5" fill="#FF8FB1" />
      <path d="M86 24c8-14 22-14 27-9-5 10-16 14-27 9z" fill="#2E9E4F" />
      <path d="M84 27c-5-12 2-21 8-23 2 9-1 18-8 23z" fill="#43B864" />
    </svg>
  );
}
