import MahiFace from './MahiFace.jsx';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-screen min-h-screen w-full flex items-center justify-center px-4 py-10 font-sans text-[#15212E]"
      style={{ background: 'radial-gradient(circle at 20% 10%, #1f4d33 0%, #12263F 55%, #0b1626 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6 text-white">
          <MahiFace size={112} />
          <div className="mt-3 text-3xl font-extrabold tracking-[0.25em]">MAHI</div>
          <div className="text-sm text-[#b9cfc3] mt-1">Personal Workflow AI Assistant</div>
          <div className="text-xs text-[#8fa79a] mt-1">VJ.Nathan · IGO Group of Companies · Digital Marketing</div>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <h1 className="m-0 text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 mb-0 text-sm text-[#667585]">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="text-center text-xs text-[#8fa79a] mt-6">One Vision. One Workflow. One Digital Companion.</p>
      </div>
    </div>
  );
}

export const inputCls = 'w-full rounded-xl border border-[#d5dbd8] bg-white px-4 py-3 text-[15px] text-[#15212E]';
export const btnCls = 'w-full rounded-xl bg-[#1B5E20] hover:bg-[#22722a] text-white font-semibold py-3 text-[15px] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const linkCls = 'bg-transparent border-0 p-0 text-[#1E6FD9] text-sm cursor-pointer underline underline-offset-2';
