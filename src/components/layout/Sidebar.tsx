import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Dna,
  Activity,
  Zap,
  BarChart2,
  Box,
  FileText,
  Plus,
  Server,
  ActivitySquare
} from 'lucide-react';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface ServerStatus {
  status: 'ok' | 'unreachable' | 'checking';
  gpuName?: string;
  message?: string;
}

const menuItems: MenuItem[] = [
  { name: '대시보드', path: '/', icon: LayoutDashboard, exact: true },
  { name: '시퀀스 입력', path: '/sequence', icon: Dna },
  { name: '변이 분석', path: '/mutation', icon: Activity },
  { name: '결합 예측', path: '/prediction', icon: Zap },
  { name: '억제제 비교', path: '/comparison', icon: BarChart2 },
  { name: '구조 뷰어', path: '/viewer', icon: Box },
  { name: '연구 보고서', path: '/report', icon: FileText },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverStatus, setServerStatus] = useState<ServerStatus>({ status: 'checking' });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/af3/health');
        if (res.ok) {
          const data = await res.json();
          setServerStatus({
            status: data.status === 'ok' ? 'ok' : 'unreachable',
            gpuName: data.gpuName || 'RTX 4070',
            message: data.message
          });
        } else {
          setServerStatus({ status: 'unreachable' });
        }
      } catch (err) {
        setServerStatus({ status: 'unreachable' });
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleStartNewAnalysis = () => {
    navigate('/sequence');
  };

  return (
    <aside className="w-64 border-r border-[#243047] bg-[#0b1020] flex flex-col shrink-0">
      {/* Top action button: Start New Analysis */}
      <div className="p-4 border-b border-[#243047]/60">
        <button
          type="button"
          onClick={handleStartNewAnalysis}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ 신규 분석 시작</span>
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          RESEARCH WORKFLOW
        </div>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path) && item.path !== '/';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border-l-4 border-cyan-400 shadow-sm shadow-cyan-500/5'
                    : 'text-gray-400 hover:bg-[#141b2d] hover:text-gray-200'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-gray-500 group-hover:text-gray-400'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom status widget: Live Ubuntu AF3 Server status */}
      <div className="p-4 border-t border-[#243047]/60 bg-[#070b18]/60 m-2 rounded-xl border border-[#243047]/40">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Server className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-gray-300">AF3 Ubuntu Server</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                serverStatus.status === 'ok'
                  ? 'bg-emerald-400 animate-pulse'
                  : serverStatus.status === 'checking'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span>{serverStatus.status === 'ok' ? serverStatus.gpuName || 'RTX 4070' : 'Offline'}</span>
          </span>
          <span
            className={`font-mono ${
              serverStatus.status === 'ok'
                ? 'text-emerald-400'
                : serverStatus.status === 'checking'
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {serverStatus.status === 'ok' ? 'Online' : serverStatus.status === 'checking' ? 'Checking' : 'Disconnected'}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#243047]/40 text-[10px] text-gray-500 flex items-center gap-1">
          <ActivitySquare className="w-3 h-3 text-gray-500" />
          <span>Mpro Dimer Mode</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
