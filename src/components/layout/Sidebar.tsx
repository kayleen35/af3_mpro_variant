import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Dna,
  Activity,
  Zap,
  GitCompareArrows,
  Network,
  FlaskConical,
  RefreshCw,
  Microscope,
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
  /** 논문 흐름상의 단계 번호 — 번호가 붙는 항목만 지정한다. */
  step?: number;
  isNew?: boolean;
  /** jobId 없이 열면 "선택된 Job이 없습니다"로 빠지는 페이지 — 현재 Job을 이어서 넘긴다. */
  needsJob?: boolean;
}

interface ServerStatus {
  status: 'ok' | 'unreachable' | 'checking';
  gpuName?: string;
  message?: string;
}

// 논문 흐름(서열 → 스크리닝 → AF3 예측 → 붕괴 분석 → 유도체 설계 → 재검증 → ADMET) 순서.
const workflowItems: MenuItem[] = [
  { name: '대시보드', path: '/', icon: LayoutDashboard, exact: true },
  { name: '서열 및 변이 입력', path: '/sequence', icon: Dna },
  { name: '도킹 내성 지도', path: '/screening', icon: Activity, step: 1 },
  { name: 'AF3 결합 예측 (실행)', path: '/prediction', icon: Zap, needsJob: true },
  { name: '결합 붕괴 분석', path: '/interaction', icon: GitCompareArrows, step: 2, needsJob: true },
  { name: '결합 취약부 2D 시각화', path: '/molecule', icon: Network },
  { name: '유도체 설계', path: '/optimization', icon: FlaskConical, step: 3, isNew: true, needsJob: true },
  { name: '결합 재검증', path: '/reevaluation', icon: RefreshCw, step: 4, isNew: true, needsJob: true },
  { name: 'ADMET 평가', path: '/final-ranking', icon: Microscope, step: 5, isNew: true, needsJob: true },
];

const toolItems: MenuItem[] = [
  { name: '3D 구조 뷰어', path: '/viewer', icon: Box, needsJob: true },
  { name: '연구 보고서', path: '/report', icon: FileText, needsJob: true },
];

/** 사이드바로 단계를 옮겨다녀도 보던 Job이 유지되도록 마지막 jobId를 기억해 둔다. */
const CURRENT_JOB_KEY = 'af3_current_job';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverStatus, setServerStatus] = useState<ServerStatus>({ status: 'checking' });

  // 현재 URL의 jobId를 계속 추적해 두었다가 메뉴 이동 시 물려준다.
  const [currentJobId, setCurrentJobId] = useState<string | null>(
    () => sessionStorage.getItem(CURRENT_JOB_KEY)
  );

  useEffect(() => {
    const urlJobId = new URLSearchParams(location.search).get('jobId');
    if (urlJobId) {
      sessionStorage.setItem(CURRENT_JOB_KEY, urlJobId);
      setCurrentJobId(urlJobId);
    }
  }, [location.search]);

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

  const renderNavLink = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path) && item.path !== '/';

    // jobId가 필요한 페이지는 보던 Job을 그대로 물려준다 —
    // 안 그러면 매번 "선택된 분석 Job이 없습니다" 빈 화면으로 떨어진다.
    const to = item.needsJob && currentJobId
      ? `${item.path}?jobId=${encodeURIComponent(currentJobId)}`
      : item.path;

    return (
      <NavLink
        key={item.path}
        to={to}
        title={item.name}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-cyan-500/15 text-cyan-400 border-l-4 border-cyan-400 shadow-sm shadow-cyan-500/5'
            : 'text-gray-400 hover:bg-[#141b2d] hover:text-gray-200'
        }`}
      >
        {item.step !== undefined && (
          <span
            className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center text-[12px] font-bold font-mono ${
              isActive
                ? 'border-cyan-400/60 text-cyan-300 bg-cyan-500/10'
                : 'border-[#243047] text-gray-500'
            }`}
          >
            {item.step}
          </span>
        )}
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive ? 'text-cyan-400' : 'text-gray-500 group-hover:text-gray-400'
          }`}
        />
        <span className="truncate flex-1">{item.name}</span>
        {item.isNew && (
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold tracking-wide">
            NEW
          </span>
        )}
      </NavLink>
    );
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
        <div className="px-3 pb-2 text-[15px] font-semibold text-gray-500 uppercase tracking-wider">
          RESEARCH WORKFLOW
        </div>
        <nav className="space-y-1">
          {workflowItems.map(renderNavLink)}
        </nav>

        <div className="px-3 pt-5 pb-2 text-[15px] font-semibold text-gray-500 uppercase tracking-wider">
          TOOLS
        </div>
        <nav className="space-y-1">
          {toolItems.map(renderNavLink)}
        </nav>
      </div>

      {/* Bottom status widget: Live Ubuntu AF3 Server status */}
      <div className="p-4 border-t border-[#243047]/60 bg-[#070b18]/60 m-2 rounded-xl border border-[#243047]/40">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Server className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-gray-300">AF3 Ubuntu Server</span>
        </div>
        <div className="flex items-center justify-between text-[15px] text-gray-400">
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
        <div className="mt-2 pt-2 border-t border-[#243047]/40 text-[15px] text-gray-500 flex items-center gap-1">
          <ActivitySquare className="w-3 h-3 text-gray-500" />
          <span>Mpro Dimer Mode</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
