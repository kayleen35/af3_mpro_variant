import React from 'react';
import { Circle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { WorkflowStepStatus } from '../../types/analysis';

interface WorkflowStepDef {
  id: string;
  label: string;
  shortLabel: string;
  path: string;
}

const STEPS: WorkflowStepDef[] = [
  { id: 'sequence',     label: 'Mpro 서열 입력',        shortLabel: '서열',     path: '/sequence' },
  { id: 'mutation',     label: 'WT 대비 변이 검출',     shortLabel: '변이',     path: '/mutation' },
  { id: 'screening',    label: '1차 스크리닝',          shortLabel: '스크리닝', path: '/screening' },
  { id: 'af3',          label: 'AF3 결합 예측',         shortLabel: 'AF3',      path: '/prediction' },
  { id: 'interaction',  label: 'WT/변이 상호작용 비교', shortLabel: '상호작용', path: '/interaction' },
  { id: 'optimization', label: '구조변경 후보 생성',    shortLabel: '최적화',   path: '/optimization' },
  { id: 'reevaluation', label: '재평가',                shortLabel: '재평가',   path: '/reevaluation' },
  { id: 'final',        label: '최종 비교',             shortLabel: '최종',     path: '/final-ranking' },
];

const STATUS_ICON: Record<WorkflowStepStatus, React.ReactNode> = {
  not_started: <Circle className="w-4 h-4 text-gray-600" />,
  ready:       <Circle className="w-4 h-4 text-cyan-400" />,
  running:     <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
  completed:   <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  failed:      <XCircle className="w-4 h-4 text-rose-400" />,
};

const CHIP_STYLE: Record<WorkflowStepStatus, string> = {
  not_started: 'bg-gray-800 border-gray-700 text-gray-500',
  ready:       'bg-cyan-950/40 border-cyan-700/50 text-cyan-300',
  running:     'bg-amber-950/40 border-amber-600/50 text-amber-300',
  completed:   'bg-emerald-950/40 border-emerald-700/50 text-emerald-300',
  failed:      'bg-rose-950/40 border-rose-700/50 text-rose-300',
};

const CONNECTOR_STYLE: Record<WorkflowStepStatus, string> = {
  not_started: 'bg-gray-700',
  ready:       'bg-cyan-700/50',
  running:     'bg-amber-600/50',
  completed:   'bg-emerald-600',
  failed:      'bg-rose-600',
};

export interface WorkflowStepperProps {
  progress: Partial<Record<string, WorkflowStepStatus>>;
  currentStep?: string;
  compact?: boolean;
  onStepClick?: (id: string, path: string) => void;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  progress, currentStep, compact = false, onStepClick,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {STEPS.map((step, i) => {
          const status = progress[step.id] ?? 'not_started';
          const isCurrent = currentStep === step.id;
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => step.path && onStepClick?.(step.id, step.path)}
                disabled={!onStepClick}
                title={step.label}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${CHIP_STYLE[status]} ${
                  isCurrent ? 'ring-1 ring-offset-1 ring-offset-[#0b1020] ring-cyan-400' : ''
                } ${onStepClick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
              >
                {STATUS_ICON[status]}
                <span>{step.shortLabel}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-3 rounded-full ${CONNECTOR_STYLE[status]}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card-base p-5 bg-[#0b1020] border-[#243047]">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          워크플로우 진행 상태
        </span>
      </div>
      <div className="relative">
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-800 rounded-full" />
        <div className="relative flex justify-between">
          {STEPS.map((step) => {
            const status = progress[step.id] ?? 'not_started';
            const isCurrent = currentStep === step.id;
            return (
              <div
                key={step.id}
                className="flex flex-col items-center gap-2"
                style={{ flex: '1 1 0', maxWidth: `${100 / STEPS.length}%` }}
              >
                <button
                  onClick={() => step.path && onStepClick?.(step.id, step.path)}
                  disabled={!onStepClick}
                  title={step.label}
                  className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                    status === 'completed' ? 'bg-emerald-950/60 border-emerald-500'
                      : status === 'running' ? 'bg-amber-950/60 border-amber-500 shadow-lg'
                      : status === 'ready' ? 'bg-cyan-950/60 border-cyan-500'
                      : status === 'failed' ? 'bg-rose-950/60 border-rose-500'
                      : 'bg-[#141b2d] border-gray-700'
                  } ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-[#0b1020] ring-cyan-400 scale-110' : ''} ${
                    onStepClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                  }`}
                >
                  <span className="text-xs font-bold text-gray-300">{STEPS.indexOf(step) + 1}</span>
                  <span className="absolute -top-1 -right-1">{STATUS_ICON[status]}</span>
                </button>
                <div className="text-center">
                  <p className={`text-[10px] font-medium leading-tight ${
                    status === 'completed' ? 'text-emerald-400'
                      : status === 'running' ? 'text-amber-400'
                      : status === 'ready' ? 'text-cyan-400'
                      : status === 'failed' ? 'text-rose-400'
                      : 'text-gray-600'
                  }`}>
                    {step.shortLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowStepper;
