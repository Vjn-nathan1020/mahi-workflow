import MahiFace from './MahiFace.jsx';

export default function Splash({ text }) {
  return (
    <div className="auth-screen min-h-screen flex flex-col items-center justify-center gap-4 font-sans text-white" style={{ background: '#12263F' }}>
      <MahiFace size={96} />
      <div className="text-sm text-[#b9cfc3]" role="status">{text || 'Loading MAHI…'}</div>
    </div>
  );
}
