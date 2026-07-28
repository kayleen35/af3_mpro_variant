import React, { useState, useMemo, useEffect } from 'react';
import {
  FlaskConical, Filter, ChevronDown, ChevronUp,
  CheckSquare, Square, Download, RefreshCw, ExternalLink, ShieldAlert,
  Beaker, Droplets, Pill, ChevronRight, Clock
} from 'lucide-react';
import axios from 'axios';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import type { Inhibitor, BindingType } from '../types/inhibitor';
import type {
  InhibitorScreeningSummary, ToxicityRisk, NasalFeasibility,
  Af3Priority, EndpointResult, PhysicochemicalProperties
} from '../types/screening';
import { NasalFeasibilityBadge, Af3PriorityBadge } from '../components/common/RiskBadge';
import { EvidenceConfidenceBadge } from '../components/common/EvidenceConfidenceBadge';
import { assessNasalFeasibility } from '../utils/nasal';

// ─── 독성/우선순위 판정 규칙 ─────────────────────────────────────────────────
// 비강 적합성 판정은 src/utils/nasal.ts의 assessNasalFeasibility로 일원화 (5단계와 공유)

function computeAf3Priority(
  toxRisk: ToxicityRisk,
  nasalFeas: NasalFeasibility,
): { priority: Af3Priority; reasons: string[] } {
  const reasons: string[] = [];
  if (toxRisk === 'low' && (nasalFeas === 'favorable' || nasalFeas === 'borderline')) {
    reasons.push('독성 모델 위험 낮음 + 비강 물성 적합성 양호');
    return { priority: 'priority', reasons };
  }
  if (toxRisk === 'high') {
    reasons.push('다수 모델에서 높은 독성 위험');
    return { priority: 'low_priority', reasons };
  }
  if (nasalFeas === 'challenging') {
    reasons.push('비강 제형 농도 달성 어려움 예측');
    return { priority: 'low_priority', reasons };
  }
  reasons.push('독성 위험 중간 또는 비강 물성 경계');
  return { priority: 'review', reasons };
}

// 미평가 endpoint 생성 헬퍼
const NOT_EVALUATED: EndpointResult = {
  endpoint: '',
  result: null,
  probability: null,
  status: 'not_evaluated',
  modelName: 'ADMET-AI (미설치)',
};

// RDKit 계산이 완료된 경우 endpoint들 중 최악값을 종합 독성 위험으로 사용, 없으면 미평가
function deriveToxicityRisk(toxData: any): ToxicityRisk {
  if (!toxData) return 'unresolved';
  const risks = [toxData.ames?.risk, toxData.herg?.risk, toxData.dili?.risk, toxData.clintox?.risk];
  if (risks.includes('high')) return 'high';
  if (risks.includes('moderate')) return 'moderate';
  if (risks.includes('low')) return 'low';
  return 'unresolved';
}

function buildScreeningSummary(inh: Inhibitor): InhibitorScreeningSummary {
  const props = inh.precomputedProperties
    ? {
        molecularWeight: inh.precomputedProperties.mw,
        tpsa: inh.precomputedProperties.tpsa,
        clogp: inh.precomputedProperties.clogp,
        hbd: inh.precomputedProperties.hbd,
        hba: inh.precomputedProperties.hba,
        rotatableBonds: inh.precomputedProperties.rotatableBonds,
        ringCount: inh.precomputedProperties.ringCount,
        formalCharge: inh.precomputedProperties.formalCharge,
        computedBy: inh.precomputedProperties.source,
        computedAt: '2024-09 (RDKit)',
      } satisfies PhysicochemicalProperties
    : undefined;

  const pp = inh.precomputedProperties;
  const { feasibility: nasalFeas, reasons: nasalReasons } = assessNasalFeasibility(
    pp ? { mw: pp.mw, tpsa: pp.tpsa, clogp: pp.clogp, hbd: pp.hbd } : undefined
  );

  // 독성: RDKit 계산 결과가 있으면 반영, 없으면 미평가
  const toxRisk: ToxicityRisk = deriveToxicityRisk((inh.precomputedProperties as any)?.toxicity);

  const { priority: af3Priority, reasons: priorityReasons } = computeAf3Priority(toxRisk, nasalFeas);

  return {
    inhibitorId: inh.id,
    inhibitorName: inh.name,
    physicochemical: props,
    toxicityResult: {
      ames:         { result: (inh.precomputedProperties as any)?.toxicity?.ames?.risk || toxRisk, probability: (inh.precomputedProperties as any)?.toxicity?.ames?.probability || 0, endpoint: 'Ames 변이원성', status: (inh.precomputedProperties as any)?.toxicity ? 'evaluated' : 'not_evaluated' },
      herg:         { result: (inh.precomputedProperties as any)?.toxicity?.herg?.risk || toxRisk, probability: (inh.precomputedProperties as any)?.toxicity?.herg?.probability || 0, endpoint: 'hERG 억제', status: (inh.precomputedProperties as any)?.toxicity ? 'evaluated' : 'not_evaluated' },
      dili:         { result: (inh.precomputedProperties as any)?.toxicity?.dili?.risk || toxRisk, probability: (inh.precomputedProperties as any)?.toxicity?.dili?.probability || 0, endpoint: 'DILI (약인성 간손상)', status: (inh.precomputedProperties as any)?.toxicity ? 'evaluated' : 'not_evaluated' },
      clintox:      { result: (inh.precomputedProperties as any)?.toxicity?.clintox?.risk || toxRisk, probability: (inh.precomputedProperties as any)?.toxicity?.clintox?.probability || 0, endpoint: 'ClinTox', status: (inh.precomputedProperties as any)?.toxicity ? 'evaluated' : 'not_evaluated' },
      cyp3a4:       { result: (inh.precomputedProperties as any)?.toxicity?.cyp3a4_inhibition ? 'high' : 'low', endpoint: 'CYP3A4 억제', status: (inh.precomputedProperties as any)?.toxicity ? 'evaluated' : 'not_evaluated' },
      cyp2d6:       { result: (inh.precomputedProperties as any)?.toxicity?.cyp2d6_inhibition ? 'high' : 'low', endpoint: 'CYP2D6 억제', status: (inh.precomputedProperties as any)?.toxicity ? 'evaluated' : 'not_evaluated' },
      cyp2c9:       { result: (inh.precomputedProperties as any)?.toxicity?.cyp2c9_inhibition ? 'high' : 'low', endpoint: 'CYP2C9 억제', status: (inh.precomputedProperties as any)?.toxicity ? 'evaluated' : 'not_evaluated' },
      cyp2c19:      { ...NOT_EVALUATED, endpoint: 'CYP2C19 억제' },
      cyp1a2:       { ...NOT_EVALUATED, endpoint: 'CYP1A2 억제' },
      cytotoxicity: { ...NOT_EVALUATED, endpoint: '일반 세포독성' },
      ld50:         { ...NOT_EVALUATED, endpoint: 'LD50 예측' },
      toxicophoreAlerts: (inh.precomputedProperties as any)?.toxicity?.structural_alerts || [],
      painsAlerts: [],
      reactiveGroupAlerts: [],
      toxicityRisk: (inh.precomputedProperties as any)?.toxicity?.clintox?.risk || toxRisk,
      reasons: (inh.precomputedProperties as any)?.toxicity?.structural_alerts?.length ? ['RDKit 구조 기반 독성 알림 감지됨'] : [],
    },
    nasalResult: {
      properties: props,
      mwOk:  pp ? (pp.mw ?? 0) <= 500 : undefined,
      tpsaOk: pp ? (pp.tpsa ?? 0) <= 140 : undefined,
      clogpOk: pp ? ((pp.clogp ?? 0) >= -1 && (pp.clogp ?? 0) <= 4) : undefined,
      solubilityRisk: 'unresolved',
      permeabilityRisk: 'unresolved',
      experimentRequired: [
        '비강 점막 자극 (실험 필요)',
        '섬모 운동 저하 (실험 필요)',
        '후각상피 독성 (실험 필요)',
        '반복 분무 독성 (실험 필요)',
        'HNE-ALI EC90 (실험 필요)',
        '실제 비강 조직 체류 시간 (실험 필요)',
      ],
      nasalFeasibility: nasalFeas,
      reasons: nasalReasons,
    },
    decision: {
      toxicityRisk: toxRisk,
      nasalFeasibility: nasalFeas,
      evidenceConfidence: props ? 'C' : 'E',
      af3Priority,
      reasons: [...nasalReasons, ...priorityReasons],
    },
    selectedForAf3: af3Priority === 'priority',
    computedAt: new Date().toISOString(),
  };
}

// ─── 필터 상태 ────────────────────────────────────────────────────────────────

interface FilterState {
  bindingType: 'all' | BindingType;
  toxRisk: 'all' | ToxicityRisk;
  nasalFeas: 'all' | NasalFeasibility;
  af3Priority: 'all' | Af3Priority;
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export const ScreeningPage: React.FC = () => {
  const [summaries, setSummaries] = useState<InhibitorScreeningSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    bindingType: 'all', toxRisk: 'all', nasalFeas: 'all', af3Priority: 'all',
  });
  const [showExperimentRequired, setShowExperimentRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSummaries(INITIAL_INHIBITORS.map(buildScreeningSummary));
  }, []);

  const calculateProperties = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const payload = INITIAL_INHIBITORS.map(inh => ({ id: inh.id, smiles: inh.smiles }));
      // Call the proxy server endpoint we just created
      const res = await axios.post('http://localhost:8000/api/screening/run', { inhibitors: payload });
      
      if (res.data.status === 'success') {
        const data = res.data.data;
        const newSummaries = INITIAL_INHIBITORS.map(inh => {
          const calc = data[inh.id];
          if (calc && !calc.error) {
            const updatedInh = {
              ...inh,
              precomputedProperties: {
                mw: calc.mw,
                tpsa: calc.tpsa,
                clogp: calc.clogp,
                hbd: calc.hbd,
                hba: calc.hba,
                rotatableBonds: calc.rotatableBonds,
                ringCount: calc.ringCount,
                formalCharge: calc.formalCharge,
                source: 'RDKit + FilterCatalogs',
                toxicity: calc.toxicity
              }
            };
            return buildScreeningSummary(updatedInh);
          }
          return buildScreeningSummary(inh);
        });
        setSummaries(newSummaries);
      } else {
        setErrorMsg('RDKit 계산 중 오류: ' + (res.data.error || '알 수 없는 오류'));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('서버 연결 실패 또는 계산 중 오류 발생.');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return summaries.filter((s) => {
      const inh = INITIAL_INHIBITORS.find((i) => i.id === s.inhibitorId);
      if (!inh) return false;
      if (filters.bindingType !== 'all' && inh.bindingType !== filters.bindingType) return false;
      if (filters.toxRisk !== 'all' && s.decision?.toxicityRisk !== filters.toxRisk) return false;
      if (filters.nasalFeas !== 'all' && s.decision?.nasalFeasibility !== filters.nasalFeas) return false;
      if (filters.af3Priority !== 'all' && s.decision?.af3Priority !== filters.af3Priority) return false;
      return true;
    });
  }, [summaries, filters]);

  const priorityCounts = useMemo(() => ({
    priority: summaries.filter((s) => s.decision?.af3Priority === 'priority').length,
    review: summaries.filter((s) => s.decision?.af3Priority === 'review').length,
    low_priority: summaries.filter((s) => s.decision?.af3Priority === 'low_priority').length,
    selected: summaries.filter((s) => s.selectedForAf3).length,
  }), [summaries]);

  const toggleSelected = (id: string) => {
    setSummaries((prev) =>
      prev.map((s) => s.inhibitorId === id ? { ...s, selectedForAf3: !s.selectedForAf3 } : s)
    );
  };

  const selectAll = (val: boolean) => setSummaries((prev) => prev.map((s) => ({ ...s, selectedForAf3: val })));
  const selectByPriority = (p: Af3Priority) => setSummaries((prev) =>
    prev.map((s) => ({ ...s, selectedForAf3: s.decision?.af3Priority === p }))
  );

  const renderEndpointStatus = (ep?: EndpointResult) => {
    if (!ep) return <span className="text-gray-600 text-base">—</span>;
    if (ep.status === 'not_evaluated') {
      return <span className="text-gray-600 text-base font-mono">미평가</span>;
    }
    if (ep.status === 'pending') {
      return <span className="text-amber-400 text-base font-mono flex items-center gap-1"><Clock className="w-3 h-3" />계산 대기</span>;
    }
    if (ep.status === 'experiment_required') {
      return <span className="text-violet-400 text-base">실험 필요</span>;
    }
    return (
      <span className={`text-base font-mono ${ep.result === 'high' || ep.result === 'moderate' ? 'text-rose-300' : 'text-emerald-300'}`}>
        {ep.result}
        {ep.probability != null && ` (${(ep.probability * 100).toFixed(0)}%)`}
      </span>
    );
  };

  const renderPropertyValue = (val?: number | null, unit = '', decimals = 1) => {
    if (val == null) return <span className="text-gray-600 text-base font-mono">—</span>;
    return <span className="text-gray-300 text-base font-mono">{val.toFixed(decimals)}{unit}</span>;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-[#243047] pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
              <FlaskConical className="w-7 h-7 text-cyan-400" />
              <span>1차 후보 스크리닝</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              독성 예측 위험 및 비강 국소 전달 적합성 기준으로 AF3 계산 우선순위를 설정합니다.
            </p>
          </div>
          <button
            onClick={calculateProperties}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isLoading ? 'RDKit 계산 중...' : 'RDKit 물성 실시간 계산'}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/20 border border-rose-700/30 text-sm text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Research use disclaimer */}
        <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-700/30 flex items-start gap-2.5 text-sm text-amber-200/80">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">Research Use Only — 인실리코 예측 위험</span>
            <span className="ml-1">
              이 단계의 독성·비강 적합성 결과는 인실리코 예측이며, 임상 안전성, 독성 확정, 치료 의사결정에 사용할 수 없습니다.
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '전체 후보', value: summaries.length, color: 'text-gray-300', bg: 'bg-[#0b1020] border-[#243047]' },
          { label: 'AF3 우선 후보', value: priorityCounts.priority, color: 'text-violet-300', bg: 'bg-violet-950/20 border-violet-700/30' },
          { label: '검토 후보', value: priorityCounts.review, color: 'text-sky-300', bg: 'bg-sky-950/20 border-sky-700/30' },
          { label: '선택된 AF3 대상', value: priorityCounts.selected, color: 'text-cyan-300', bg: 'bg-cyan-950/20 border-cyan-700/30' },
        ].map((c) => (
          <div key={c.label} className={`card-base p-4 ${c.bg}`}>
            <p className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + selection bar */}
      <div className="card-base p-4 bg-[#0b1020] border-[#243047] flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-500 shrink-0" />

        <select
          value={filters.bindingType}
          onChange={(e) => setFilters((f) => ({ ...f, bindingType: e.target.value as FilterState['bindingType'] }))}
          className="px-3 py-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-300 text-sm focus:outline-none focus:border-cyan-500"
        >
          <option value="all">모든 결합 유형</option>
          <option value="covalent">공유결합</option>
          <option value="reversible_covalent">가역적 공유결합</option>
          <option value="non_covalent">비공유결합</option>
        </select>

        <select
          value={filters.nasalFeas}
          onChange={(e) => setFilters((f) => ({ ...f, nasalFeas: e.target.value as FilterState['nasalFeas'] }))}
          className="px-3 py-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-300 text-sm focus:outline-none focus:border-cyan-500"
        >
          <option value="all">모든 비강 적합성</option>
          <option value="favorable">비강 적합성 양호</option>
          <option value="borderline">비강 적합성 경계</option>
          <option value="challenging">비강 적합성 불리</option>
          <option value="unresolved">미평가</option>
        </select>

        <select
          value={filters.af3Priority}
          onChange={(e) => setFilters((f) => ({ ...f, af3Priority: e.target.value as FilterState['af3Priority'] }))}
          className="px-3 py-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-300 text-sm focus:outline-none focus:border-cyan-500"
        >
          <option value="all">모든 AF3 우선순위</option>
          <option value="priority">우선 (priority)</option>
          <option value="review">검토 (review)</option>
          <option value="low_priority">낮음 (low_priority)</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => selectAll(true)}
            className="px-2.5 py-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            전체 선택
          </button>
          <button
            onClick={() => selectByPriority('priority')}
            className="px-2.5 py-1.5 rounded-lg bg-violet-950/40 border border-violet-700/40 text-violet-300 hover:text-violet-100 text-sm transition-colors"
          >
            Priority만 선택
          </button>
          <button
            onClick={() => selectAll(false)}
            className="px-2.5 py-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            선택 해제
          </button>
        </div>
      </div>

      {/* Main table */}
      <div className="card-base bg-[#0b1020] border-[#243047] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#243047]">
                <th className="w-8 px-3 py-3 text-left text-gray-500">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-[#141b2d] accent-cyan-500"
                    checked={summaries.length > 0 && summaries.every((s) => s.selectedForAf3)}
                    onChange={(e) => selectAll(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-3 text-left text-base font-semibold text-gray-500 uppercase tracking-wider">이름</th>
                <th className="px-3 py-3 text-left text-base font-semibold text-gray-500 uppercase tracking-wider">결합 유형</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">MW</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">TPSA</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">cLogP</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">HBD/HBA</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">Ames</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">hERG</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">DILI</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">비강 적합성</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">근거 신뢰도</th>
                <th className="px-3 py-3 text-center text-base font-semibold text-gray-500 uppercase tracking-wider">AF3 우선순위</th>
                <th className="w-8 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2235]">
              {filtered.map((summary) => {
                const inh = INITIAL_INHIBITORS.find((i) => i.id === summary.inhibitorId)!;
                const decision = summary.decision;
                const isExpanded = expandedId === summary.inhibitorId;
                const pp = summary.physicochemical;

                const bindingLabel =
                  inh.bindingType === 'reversible_covalent' ? '가역적 공유' :
                  inh.bindingType === 'covalent' ? '공유결합' : '비공유결합';

                const bindingColor =
                  inh.bindingType === 'reversible_covalent' ? 'text-amber-300 bg-amber-950/40 border-amber-700/40' :
                  inh.bindingType === 'covalent' ? 'text-orange-300 bg-orange-950/40 border-orange-700/40' :
                  'text-sky-300 bg-sky-950/40 border-sky-700/40';

                return (
                  <React.Fragment key={summary.inhibitorId}>
                    <tr className={`transition-colors ${isExpanded ? 'bg-[#0d1525]' : 'hover:bg-[#0e1628]'}`}>
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <button onClick={() => toggleSelected(summary.inhibitorId)}>
                          {summary.selectedForAf3
                            ? <CheckSquare className="w-4 h-4 text-cyan-400" />
                            : <Square className="w-4 h-4 text-gray-600" />
                          }
                        </button>
                      </td>

                      {/* Name */}
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-semibold text-gray-200">{inh.name}</p>
                          {inh.developmentStatusLabel && (
                            <p className="text-base text-gray-500 mt-0.5">{inh.developmentStatusLabel}</p>
                          )}
                          {inh.warheadType && inh.warheadType !== 'none' && (
                            <span className="text-sm font-mono text-orange-400/80">{inh.warheadType}</span>
                          )}
                        </div>
                      </td>

                      {/* Binding type */}
                      <td className="px-3 py-3">
                        <span className={`text-base font-medium px-2 py-0.5 rounded-md border ${bindingColor}`}>
                          {bindingLabel}
                        </span>
                      </td>

                      {/* MW */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center">
                          {renderPropertyValue(pp?.molecularWeight, ' Da', 0)}
                          {pp?.molecularWeight && (
                            <span className={`text-sm mt-0.5 ${pp.molecularWeight <= 500 ? 'text-emerald-500' : pp.molecularWeight <= 600 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {pp.molecularWeight <= 500 ? '✓' : pp.molecularWeight <= 600 ? '△' : '✗'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TPSA */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center">
                          {renderPropertyValue(pp?.tpsa, ' Å²', 0)}
                          {pp?.tpsa && (
                            <span className={`text-sm mt-0.5 ${pp.tpsa <= 140 ? 'text-emerald-500' : pp.tpsa <= 180 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {pp.tpsa <= 140 ? '✓' : pp.tpsa <= 180 ? '△' : '✗'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* cLogP */}
                      <td className="px-3 py-3 text-center">
                        {renderPropertyValue(pp?.clogp, '', 2)}
                      </td>

                      {/* HBD/HBA */}
                      <td className="px-3 py-3 text-center">
                        {pp?.hbd != null && pp?.hba != null
                          ? <span className="text-gray-300 text-base font-mono">{pp.hbd}/{pp.hba}</span>
                          : <span className="text-gray-600 text-base">—</span>
                        }
                      </td>

                      {/* Ames */}
                      <td className="px-3 py-3 text-center">
                        {renderEndpointStatus(summary.toxicityResult?.ames)}
                      </td>

                      {/* hERG */}
                      <td className="px-3 py-3 text-center">
                        {renderEndpointStatus(summary.toxicityResult?.herg)}
                      </td>

                      {/* DILI */}
                      <td className="px-3 py-3 text-center">
                        {renderEndpointStatus(summary.toxicityResult?.dili)}
                      </td>

                      {/* Nasal feasibility */}
                      <td className="px-3 py-3 text-center">
                        {decision ? <NasalFeasibilityBadge feasibility={decision.nasalFeasibility} /> : '—'}
                      </td>

                      {/* Evidence confidence */}
                      <td className="px-3 py-3 text-center">
                        {decision ? <EvidenceConfidenceBadge confidence={decision.evidenceConfidence} /> : '—'}
                      </td>

                      {/* AF3 priority */}
                      <td className="px-3 py-3 text-center">
                        {decision ? <Af3PriorityBadge priority={decision.af3Priority} /> : '—'}
                      </td>

                      {/* Expand */}
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : summary.inhibitorId)}
                          className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <tr className="bg-[#080f1e]">
                        <td colSpan={14} className="px-6 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Col 1: SMILES + binding info */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
                                <Beaker className="w-3.5 h-3.5 text-cyan-400" />
                                구조 정보
                              </h4>
                              <div className="p-3 rounded-lg bg-[#141b2d] border border-[#243047]">
                                <p className="text-base text-gray-500 mb-1">SMILES</p>
                                <p className="text-base font-mono text-gray-300 break-all leading-relaxed">{inh.smiles}</p>
                              </div>
                              <div className="space-y-1 text-base">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">결합 유형</span>
                                  <span className="text-gray-300">{inh.bindingType}</span>
                                </div>
                                {inh.warheadType && inh.warheadType !== 'none' && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Warhead</span>
                                    <span className="text-orange-300">{inh.warheadType}</span>
                                  </div>
                                )}
                                {inh.knownRoute && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">알려진 투여 경로</span>
                                    <span className="text-gray-300">{inh.knownRoute}</span>
                                  </div>
                                )}
                              </div>
                              {inh.sourceReferences.map((ref, i) => (
                                <div key={i} className="text-sm text-gray-600 flex items-center gap-1">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>{ref.source}</span>
                                  {ref.year && <span>({ref.year})</span>}
                                </div>
                              ))}
                            </div>

                            {/* Col 2: Physicochemical + Nasal */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
                                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                                물성 및 비강 적합성
                              </h4>
                              {pp ? (
                                <div className="space-y-1">
                                  {[
                                    ['분자량(MW)', `${pp.molecularWeight?.toFixed(0)} Da`],
                                    ['TPSA', `${pp.tpsa?.toFixed(0)} Å²`],
                                    ['cLogP', pp.clogp?.toFixed(2)],
                                    ['HBD', pp.hbd],
                                    ['HBA', pp.hba],
                                    ['회전결합 수', pp.rotatableBonds],
                                    ['Ring 수', pp.ringCount],
                                    ['Formal Charge', pp.formalCharge],
                                  ].map(([k, v]) => (
                                    <div key={String(k)} className="flex justify-between text-base">
                                      <span className="text-gray-500">{k}</span>
                                      <span className="text-gray-300 font-mono">{v ?? '—'}</span>
                                    </div>
                                  ))}
                                  <div className="mt-1 pt-1 border-t border-[#243047]">
                                    <p className="text-sm text-gray-600">출처: {pp.computedBy} — {pp.computedAt}</p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-base text-gray-600">사전 계산 물성값 없음</p>
                              )}
                              {summary.nasalResult?.reasons.map((r, i) => (
                                <p key={i} className="text-base text-gray-400">• {r}</p>
                              ))}
                            </div>

                            {/* Col 3: Toxicity + Experiment required */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
                                <Pill className="w-3.5 h-3.5 text-rose-400" />
                                독성 예측 endpoint
                              </h4>
                              <div className="space-y-1">
                                {Object.entries(summary.toxicityResult ?? {}).filter(([k]) =>
                                  ['ames','herg','dili','clintox','cyp3a4','cyp2d6','cyp2c9','cyp2c19','cyp1a2','cytotoxicity'].includes(k)
                                ).map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-base">
                                    <span className="text-gray-500">{(v as EndpointResult)?.endpoint || k}</span>
                                    {renderEndpointStatus(v as EndpointResult)}
                                  </div>
                                ))}
                              </div>

                              <div className="mt-2 pt-2 border-t border-[#243047]">
                                <button
                                  onClick={() => setShowExperimentRequired((v) => !v)}
                                  className="text-base text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                                >
                                  <ChevronRight className={`w-3 h-3 transition-transform ${showExperimentRequired ? 'rotate-90' : ''}`} />
                                  실험 검증 필요 항목
                                </button>
                                {showExperimentRequired && (
                                  <ul className="mt-2 space-y-1">
                                    {summary.nasalResult?.experimentRequired.map((item, i) => (
                                      <li key={i} className="text-base text-gray-500 flex items-start gap-1">
                                        <span className="text-violet-500 mt-0.5">•</span>
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Decision summary */}
                          {decision && (
                            <div className="mt-4 p-3 rounded-lg bg-[#141b2d] border border-[#243047]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base text-gray-500 font-semibold">판정 근거:</span>
                                {decision.reasons.map((r, i) => (
                                  <span key={i} className="text-base text-gray-400 bg-[#0b1020] px-2 py-0.5 rounded border border-[#243047]">{r}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between p-4 card-base bg-[#0b1020] border-[#243047]">
        <div className="text-sm text-gray-400">
          <span className="font-semibold text-cyan-400">{priorityCounts.selected}</span>개 선택됨
          {' '}/ {summaries.length}개 전체
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-400 hover:text-gray-200 text-sm transition-colors">
            <Download className="w-3.5 h-3.5" />
            스크리닝 결과 CSV
          </button>
          <button
            disabled={priorityCounts.selected === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold text-sm transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            선택 후보 AF3 예측 시작
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Platform disclaimer */}
      <div className="text-base text-gray-600 text-center py-2 leading-relaxed">
        본 플랫폼은 AlphaFold 3, cheminformatics 및 ADMET 예측 모델을 이용한 연구·교육용 인실리코 후보 탐색 도구입니다.
        예측 구조와 계산 점수는 실제 결합 친화도, 항바이러스 효과, 독성, 임상 안전성 또는 비강 투여 가능성을 확정하지 않습니다.
        모든 결과는 효소·세포·비강 상피·동물 및 임상 검증이 필요합니다.
      </div>
    </div>
  );
};

export default ScreeningPage;
