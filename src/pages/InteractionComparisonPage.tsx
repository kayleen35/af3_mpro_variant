import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  GitCompare, Terminal, AlertTriangle, ArrowRight,
  Atom, Zap, Droplets, Link2, ChevronDown, ChevronUp, FlipHorizontal, FlaskConical
} from "lucide-react";
import { getAnalysisJob, getJobsList } from "../api/analysisApi";
import type { JobSummary } from "../api/analysisApi";
import type { AnalysisJob } from "../types/analysis";
import { EmptyState, LoadingState, ErrorState } from "../components/common";
import client from "../api/client";

interface StructureAnalysisResult {
  inhibitorId: string;
  variant: string;
  plddt: { mean: number | null; min: number | null; max: number | null; classification?: string };
  contacts: {
    total: number;
    byResidue: { resseq: number; resname: string; count: number }[];
    anchorResidues: Record<string, { label: string; count: number; details: object[] }>;
  };
  hbonds: { count: number; details: { lig_atom: string; prot_resname: string; prot_resseq: number; prot_atom: string; distance: number }[] };
  buriedArea: { buried_A2: number; ligand_A2: number; percent: number };
  chimeraxCommands: { plddt: string; contacts_total: string; contacts_anchor: string[]; buried: string; hbonds: string };
}

function PlddtBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 90 ? "#1d4ed8" : value >= 70 ? "#0ea5e9" : value >= 50 ? "#eab308" : "#f97316";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-[#1e2d40] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-mono font-bold text-gray-200 w-10 text-right">{value}</span>
    </div>
  );
}

function CompareRow({ label, wtValue, mutValue, better, unit = "" }: {
  label: string; wtValue: React.ReactNode; mutValue: React.ReactNode;
  better?: "wt" | "mut" | "equal" | null; unit?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-[#1e2d40]/50 last:border-0">
      <div className={`text-right font-mono font-bold text-sm ${better === "wt" ? "text-emerald-400" : "text-gray-200"}`}>
        {wtValue}{unit && <span className="text-xs text-gray-500 ml-1">{unit}</span>}
      </div>
      <div className="text-center text-xs text-gray-500 px-3 min-w-[110px] whitespace-nowrap">{label}</div>
      <div className={`text-left font-mono font-bold text-sm ${better === "mut" ? "text-cyan-400" : "text-gray-200"}`}>
        {mutValue}{unit && <span className="text-xs text-gray-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

interface PanelProps {
  title: string; subtitle: string; accentClass: string;
  job: AnalysisJob | null;
  fallbackInhibitors?: AnalysisJob["inhibitors"]; // WT 패널에 억제제가 없을 때 변이형 Job의 목록 가져오기
  selectedInhibitor: string; onSelectInhibitor: (id: string) => void;
  analysisResult: StructureAnalysisResult | null; analyzing: boolean; analyzeError: string | null;
  onAnalyze: () => void; expandedAnchor: string | null; setExpandedAnchor: (v: string | null) => void;
  expandedHbond: boolean; setExpandedHbond: (v: boolean) => void;
}

function AnalysisPanel({ title, subtitle, accentClass, job, fallbackInhibitors, selectedInhibitor, onSelectInhibitor,
  analysisResult, analyzing, analyzeError, onAnalyze, expandedAnchor, setExpandedAnchor, expandedHbond, setExpandedHbond }: PanelProps) {
  // 억제제 목록: 자체 job 내에 억제제가 없으면 분릆된 fallbackInhibitors 사용
  const rawInhibitors = (job?.inhibitors?.length ?? 0) > 0 ? (job?.inhibitors ?? []) : (fallbackInhibitors ?? []);
  const completedInhibitors = rawInhibitors.filter(i => i.status === "completed");
  const options = completedInhibitors.length > 0 ? completedInhibitors : rawInhibitors;
  const selectedInh = rawInhibitors.find(i => i.inhibitorId === selectedInhibitor);
  const usingFallback = (job?.inhibitors?.length ?? 0) === 0 && (fallbackInhibitors?.length ?? 0) > 0;
  return (
    <div className="flex-1 min-w-0 space-y-4">
      <div className={`rounded-xl p-4 border ${accentClass}`}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5 opacity-70">{subtitle}</p>
        <h2 className="text-lg font-bold">{title}</h2>
        {job?.mutations && job.mutations.length > 0 && (
          <p className="text-xs mt-1 opacity-60 font-mono">{job.mutations.map(m => `${m.wildTypeResidue}${m.position}${m.mutantResidue}`).join(" / ")}</p>
        )}
      </div>
      <div className="card-base p-4 bg-[#0b1020] border-[#1e2d40]">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">억제제 선택</label>
        {usingFallback && (
          <div className="mb-3 p-3 bg-amber-950/40 border border-amber-600/40 rounded-lg">
            <p className="text-xs text-amber-400 font-bold mb-1">⚠ 비교 불가 (구조체 파일 없음)</p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              선택하신 WT Job은 억제제 없이 단독으로 연산(Apo)되었습니다. AlphaFold3는 리간드와 단백질을 동시에 연산(Co-folding)해야만 결합 구조(CIF)가 생성됩니다.<br/>
              <strong>1차 화면으로 돌아가 WT 서열과 억제제(nirmatrelvir)를 함께 선택하여 새 Job을 만들어주세요.</strong>
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <select value={selectedInhibitor} onChange={(e) => onSelectInhibitor(e.target.value)} disabled={usingFallback}
            className="flex-1 px-3 py-2 rounded-lg bg-[#141b2d] border border-[#1e2d40] text-gray-100 text-sm font-mono focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50">
            {options.map(i => <option key={i.inhibitorId} value={i.inhibitorId}>{i.inhibitorId}</option>)}
          </select>
          <button type="button" onClick={onAnalyze} disabled={analyzing || !selectedInhibitor || usingFallback}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            {analyzing ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />분석 중</> : <><Atom className="w-3.5 h-3.5" />분석</>}
          </button>
        </div>
        {selectedInh?.metrics && (
          <div className="mt-3 pt-3 border-t border-[#1e2d40] grid grid-cols-4 gap-2">
            {[{ label: "ipTM", value: selectedInh.metrics.iptm?.toFixed(3) ?? "—" },
              { label: "pTM", value: selectedInh.metrics.ptm?.toFixed(3) ?? "—" },
              { label: "Ranking", value: selectedInh.metrics.rankingScore?.toFixed(3) ?? "—" },
              { label: "Clash", value: selectedInh.metrics.hasClash != null ? (selectedInh.metrics.hasClash ? "⚠ Yes" : "✓ No") : "—" }
            ].map(m => (
              <div key={m.label} className="text-center">
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-sm font-mono font-bold text-gray-100">{m.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {analyzeError && <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">⚠ {analyzeError}</div>}
      {analysisResult && (
        <div className="space-y-4">
          <div className="card-base p-4 bg-[#0b1020] border-[#1e2d40]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1e2d40]">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-gray-100">pLDDT 구조 신뢰도</h3>
              {analysisResult.plddt.classification && (
                <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 border border-cyan-700/50">{analysisResult.plddt.classification}</span>
              )}
            </div>
            {analysisResult.plddt.mean != null ? (
              <div className="space-y-2">
                {[{ label: "평균", value: analysisResult.plddt.mean }, { label: "최솟값", value: analysisResult.plddt.min! }, { label: "최댓값", value: analysisResult.plddt.max! }].map(({ label, value }) => (
                  <div key={label}><p className="text-xs text-gray-500 mb-1">{label}</p><PlddtBar value={value} /></div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">pLDDT 데이터 없음</p>}
          </div>
          <div className="card-base p-4 bg-[#0b1020] border-[#1e2d40]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1e2d40]">
              <Link2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-gray-100">접촉수 (contacts)</h3>
              <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 border border-cyan-700/50">총 {analysisResult.contacts.total}개</span>
            </div>
            <div className="mb-3 px-3 py-2 rounded-lg bg-[#141b2d] border border-[#1e2d40] text-xs font-mono text-gray-300">
              총 접촉 (리간드↔단백질) <span className="text-cyan-300 font-bold">{analysisResult.contacts.total}개</span>
              <span className="text-gray-500"> (&lt; 4.0 Å)</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(analysisResult.contacts.anchorResidues).map(([resseq, info]) => (
                <div key={resseq} className="border border-[#1e2d40] rounded-lg overflow-hidden">
                  <button type="button" onClick={() => setExpandedAnchor(expandedAnchor === resseq ? null : resseq)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[#141b2d] hover:bg-[#1a2540] transition-colors">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-cyan-400 font-mono">:{resseq}</code>
                      <span className="text-xs text-gray-300">{info.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold font-mono text-cyan-300">{info.count}개</span>
                      {expandedAnchor === resseq ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                    </div>
                  </button>
                  {expandedAnchor === resseq && (
                    <div className="px-3 py-2 overflow-x-auto">
                      <table className="w-full text-xs font-mono"><thead>
                        <tr className="text-gray-500 border-b border-[#1e2d40]"><td className="pb-1 pr-3">Lig</td><td className="pb-1 pr-3">Prot</td><td className="pb-1 text-right">Å</td></tr>
                      </thead><tbody>
                        {(info.details as any[]).slice(0, 5).map((d, i) => (
                          <tr key={i} className="text-gray-300 border-b border-[#1e2d40]/50">
                            <td className="py-0.5 pr-3 text-cyan-400">{d.lig_atom}</td>
                            <td className="py-0.5 pr-3">{d.prot_atom}</td>
                            <td className="py-0.5 text-right text-emerald-400">{d.distance}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </div>
              ))}
              {Object.keys(analysisResult.contacts.anchorResidues).length === 0 && <p className="text-xs text-gray-500 py-1">주요 잔기 접촉 없음</p>}
            </div>
          </div>
          <div className="card-base p-4 bg-[#0b1020] border-[#1e2d40]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1e2d40]">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-gray-100">매몰 면적 (buried area)</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ label: "매몰 면적", value: `${analysisResult.buriedArea.buried_A2}`, unit: "Å²", color: "text-cyan-400" },
                { label: "리간드 표면", value: `${analysisResult.buriedArea.ligand_A2}`, unit: "Å²", color: "text-gray-200" },
                { label: "매몰 비율", value: `${analysisResult.buriedArea.percent}`, unit: "%", color: analysisResult.buriedArea.percent >= 30 ? "text-emerald-400" : "text-amber-400" }
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-[#141b2d] rounded-lg p-2 border border-[#1e2d40] text-center">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className={`text-base font-bold font-mono ${color}`}>{value}<span className="text-xs text-gray-500 ml-0.5">{unit}</span></p>
                </div>
              ))}
            </div>
          </div>
          <div className="card-base p-4 bg-[#0b1020] border-[#1e2d40]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1e2d40]">
              <AlertTriangle className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-gray-100">수소결합 (H-bonds)</h3>
              <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 border border-cyan-700/50">{analysisResult.hbonds.count}개</span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-[#141b2d] border border-[#1e2d40] text-xs font-mono text-gray-300">
              <span className="text-cyan-300 font-bold">{analysisResult.hbonds.count}개</span>
              <span className="text-gray-500"> (D-A &lt; 3.5 Å)</span>
            </div>
            {analysisResult.hbonds.count > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setExpandedHbond(!expandedHbond)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-mono">
                  {expandedHbond ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expandedHbond ? "접기" : `상세 (${analysisResult.hbonds.count}건)`}
                </button>
                {expandedHbond && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs font-mono border border-[#1e2d40] rounded-lg overflow-hidden">
                      <thead className="bg-[#141b2d]"><tr className="text-gray-500">
                        <td className="px-2 py-1.5">리간드</td><td className="px-2 py-1.5">잔기</td>
                        <td className="px-2 py-1.5">단백질</td><td className="px-2 py-1.5 text-right">Å</td>
                      </tr></thead>
                      <tbody>
                        {analysisResult.hbonds.details.map((h, i) => (
                          <tr key={i} className="border-t border-[#1e2d40] text-gray-300 hover:bg-[#141b2d]/60">
                            <td className="px-2 py-1 text-cyan-400">{h.lig_atom}</td>
                            <td className="px-2 py-1 text-violet-300">{h.prot_resname}:{h.prot_resseq}</td>
                            <td className="px-2 py-1">{h.prot_atom}</td>
                            <td className="px-2 py-1 text-right text-emerald-400">{h.distance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
      {!analysisResult && !analyzing && (
        <div className="card-base p-6 bg-[#0b1020] border-[#1e2d40] flex flex-col items-center text-center gap-3">
          <Terminal className="w-10 h-10 text-gray-600" />
          <p className="text-sm text-gray-500">억제제를 선택하고 [분석] 버튼을 클릭하세요.</p>
        </div>
      )}
    </div>
  );
}

function ComparisonSummary({ wt, mut }: { wt: StructureAnalysisResult; mut: StructureAnalysisResult }) {
  const metrics = [
    { label: "pLDDT 평균", wtVal: wt.plddt.mean, mutVal: mut.plddt.mean, higherIsBetter: true },
    { label: "총 접촉수", wtVal: wt.contacts.total, mutVal: mut.contacts.total, higherIsBetter: true, unit: "개" },
    { label: "수소결합", wtVal: wt.hbonds.count, mutVal: mut.hbonds.count, higherIsBetter: true, unit: "개" },
    { label: "매몰 면적", wtVal: wt.buriedArea.buried_A2, mutVal: mut.buriedArea.buried_A2, higherIsBetter: true, unit: "Å²" },
    { label: "매몰 비율", wtVal: wt.buriedArea.percent, mutVal: mut.buriedArea.percent, higherIsBetter: true, unit: "%" },
    { label: "Cys145 접촉", wtVal: wt.contacts.anchorResidues["145"]?.count ?? 0, mutVal: mut.contacts.anchorResidues["145"]?.count ?? 0, higherIsBetter: true, unit: "개" },
    { label: "Glu166 접촉", wtVal: wt.contacts.anchorResidues["166"]?.count ?? 0, mutVal: mut.contacts.anchorResidues["166"]?.count ?? 0, higherIsBetter: true, unit: "개" },
  ];
  return (
    <div className="card-base p-5 bg-[#0b1020] border-[#1e2d40]">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1e2d40]">
        <FlipHorizontal className="w-5 h-5 text-cyan-400" />
        <h3 className="text-base font-bold text-gray-100">야생형 vs 변이형 — 수치 비교 요약</h3>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-2">
        <div className="text-right text-xs font-bold text-emerald-400 uppercase tracking-wider">야생형 (WT)</div>
        <div className="min-w-[110px]" />
        <div className="text-left text-xs font-bold text-cyan-400 uppercase tracking-wider">변이형 (Mutant)</div>
      </div>
      {metrics.map((m) => {
        const wv = m.wtVal ?? 0;
        const mv = m.mutVal ?? 0;
        let better: "wt" | "mut" | "equal" | null = wv === mv ? "equal" : m.higherIsBetter ? (wv > mv ? "wt" : "mut") : (wv < mv ? "wt" : "mut");
        return <CompareRow key={m.label} label={m.label} wtValue={m.wtVal ?? "—"} mutValue={m.mutVal ?? "—"} better={better} unit={m.unit} />;
      })}
      <p className="text-xs text-gray-600 mt-3">※ 값이 높을수록 유리한 항목에서 더 높은 쪽을 강조 표시합니다.</p>
    </div>
  );
}

export const InteractionComparisonPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get("jobId");

  // WT 패널 별도 JobId
  const [wtJobInput, setWtJobInput] = useState<string>("");   // 입력 중인 값
  const [wtJobId, setWtJobId]       = useState<string>("");   // 확정된 WT Job ID
  const [wtJobLoading, setWtJobLoading] = useState(false);
  const [wtJobError, setWtJobError]   = useState<string | null>(null);
  const [allJobs, setAllJobs]         = useState<JobSummary[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [wtJob, setWtJob] = useState<AnalysisJob | null>(null);
  const [wtInhibitor, setWtInhibitor] = useState<string>("");
  const [wtResult, setWtResult] = useState<StructureAnalysisResult | null>(null);
  const [wtAnalyzing, setWtAnalyzing] = useState(false);
  const [wtError, setWtError] = useState<string | null>(null);
  const [wtExpandedAnchor, setWtExpandedAnchor] = useState<string | null>(null);
  const [wtExpandedHbond, setWtExpandedHbond] = useState(false);

  const [mutJob, setMutJob] = useState<AnalysisJob | null>(null);
  const [mutInhibitor, setMutInhibitor] = useState<string>("");
  const [mutResult, setMutResult] = useState<StructureAnalysisResult | null>(null);
  const [mutAnalyzing, setMutAnalyzing] = useState(false);
  const [mutError, setMutError] = useState<string | null>(null);
  const [mutExpandedAnchor, setMutExpandedAnchor] = useState<string | null>(null);
  const [mutExpandedHbond, setMutExpandedHbond] = useState(false);

  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState<string | null>(null);

  const runAnalyze = useCallback(async (
    job: AnalysisJob, inhibitorId: string,
    setAnalyzing: (v: boolean) => void, setResult: (v: StructureAnalysisResult | null) => void,
    setErr: (v: string | null) => void, jid: string,
    // WT 패널: overrideJobIdForPath가 있으면 그 job ID 기반으로 경로를 직접 구성
    overrideJobIdForPath?: string,
  ) => {
    if (!inhibitorId) return;
    setAnalyzing(true); setErr(null); setResult(null);

    let filepath: string;
    if (overrideJobIdForPath) {
      // WT 패널 — WT job ID 기반으로 경로를 구성하되, db에 있으면 그 경로 사용
      let wtJob;
      try { wtJob = await getAnalysisJob(overrideJobIdForPath); } catch {}
      const wtInh = wtJob?.inhibitors?.find(i => i.inhibitorId === inhibitorId);
      filepath = wtInh?.structureFilePath || `/api/af3/output/${overrideJobIdForPath}_${inhibitorId}/${overrideJobIdForPath}_${inhibitorId}_model.cif`;
    } else {
      // 변이형 패널 — structureFilePath 우선, 없으면 기본 경로
      const inh = job.inhibitors?.find(i => i.inhibitorId === inhibitorId);
      filepath = inh?.structureFilePath || `/af3_outputs/${jid}/${inhibitorId}/model.cif`;
    }

    try {
      const res = await client.post("/api/structure/analyze", {
        filepath, inhibitorId,
        variant: job.mutations?.map(m => `${m.wildTypeResidue}${m.position}${m.mutantResidue}`).join("/") || "WT",
      });
      setResult(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.response?.data?.details || "구조 분석 실패 — AF3 출력 파일 경로를 확인하세요.");
    } finally { setAnalyzing(false); }
  }, []);

  // WT Job 로드 핸들러
  const loadWtJob = useCallback(async (jid: string) => {
    if (!jid.trim()) return;
    setWtJobLoading(true); setWtJobError(null); setWtJob(null); setWtResult(null);
    try {
      const data = await getAnalysisJob(jid.trim());
      setWtJob(data);
      setWtJobId(jid.trim());
      const all = data.inhibitors ?? [];
      const completed = all.filter(i => i.status === "completed");
      const pool = completed.length > 0 ? completed : all;
      if (pool[0]) setWtInhibitor(pool[0].inhibitorId);
    } catch (e: any) {
      const is404 = e?.response?.status === 404;
      setWtJobError(
        is404
          ? `서버가 재시작되어 Job 정보가 초기화되었습니다. 🔄 WSL 동기화 버튼을 눌러 다시 불러오세요. (${jid})`
          : `Job을 찾을 수 없습니다: ${jid} — 올바른 Job ID를 입력하세요.`
      );
    } finally { setWtJobLoading(false); }
  }, []);

  // WSL 완료 Job 동기화 → 드롭다운에 추가
  const syncWslJobs = useCallback(async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await client.post('/api/sync-wsl-jobs');
      setSyncMessage(res.data.message || 'WSL 동기화 완료');
      // 목록 새로고침
      const { jobs } = await getJobsList();
      setAllJobs(jobs);
    } catch (e: any) {
      setSyncMessage(`동기화 실패: ${e?.response?.data?.error || e?.message || '알 수 없는 오류'}`);
    } finally {
      setSyncLoading(false);
    }
  }, []);

  // 전체 Job 목록 로드 + WT 자동 선택
  useEffect(() => {
    getJobsList().then(({ jobs }) => {
      setAllJobs(jobs);
      const wtCandidate = jobs.find(j => j.mutationCount === 0 && j.jobId !== jobId);
      if (wtCandidate) {
        loadWtJob(wtCandidate.jobId);
        setWtJobInput(wtCandidate.jobId);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // 변이형 Job 초기 로드 + WT 패널에서 사용할 기본 억제제 선택
  useEffect(() => {
    if (!mutJob) return;
    const all = mutJob.inhibitors ?? [];
    const completed = all.filter(i => i.status === "completed");
    const pool = completed.length > 0 ? completed : all;
    // WT 패널 억제제도 mutant와 동일한 억제제로 동기화
    if (pool[0] && !wtInhibitor) setWtInhibitor(pool[0].inhibitorId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutJob]);
  useEffect(() => {
    if (!jobId) { setLoading(false); return; }
    getAnalysisJob(jobId)
      .then((data) => {
        const all = data.inhibitors ?? [];
        const completed = all.filter(i => i.status === "completed");
        const pool = completed.length > 0 ? completed : all;
        const first = pool[0];
        setMutJob(data);
        if (first) {
          setMutInhibitor(first.inhibitorId);
          runAnalyze(data, first.inhibitorId, setMutAnalyzing, setMutResult, setMutError, jobId);
        }
      })
      .catch((e) => setError(e?.response?.data?.message || "데이터 로드 실패"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (!jobId) {
    return <EmptyState title="분석 Job이 없습니다" description="AF3 결합 예측이 완료된 후 구조 분석을 진행할 수 있습니다." actionLabel="AF3 결합 예측으로 이동" onAction={() => navigate("/prediction")} icon={<GitCompare className="w-7 h-7 stroke-[1.5] text-cyan-500/70" />} />;
  }
  if (loading) return <LoadingState title="데이터 로딩 중..." description="AF3 예측 결과를 불러오고 있습니다." />;
  if (error) return <ErrorState title="데이터 로드 실패" message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="border-b border-[#1e2d40] pb-4">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono text-cyan-400">
          <span>JOB ID: {jobId}</span><span>•</span><span>STEP 5 — AF3 구조 분석</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
          <GitCompare className="w-7 h-7 text-cyan-400" />
          <span>AF3 구조 분석</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">야생형 (WT) Mpro와 변이형 Mpro의 억제제 결합 구조를 나란히 비교합니다.</p>
      </div>

      <div className="rounded-xl border border-[#1e2d40] bg-[#0d1625] px-5 py-4 flex items-start gap-3">
        <FlipHorizontal className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-gray-300 font-semibold mb-1">야생형 (WT) Job 선택</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-3">
            서버에 저장된 Job 목록에서 <strong className="text-gray-300">변이 없이 돌린 WT Job</strong>을 선택하면 왼쪽 패널에 자동으로 로드됩니다.
            변이 정보(예: E166V)가 이미 저장되어 있으므로 WT 서열과 비교할 수 있습니다.
          </p>
          <div className="flex gap-2 flex-wrap">
            {allJobs.length > 0 ? (
              <select
                value={wtJobInput}
                onChange={(e) => { setWtJobInput(e.target.value); if (e.target.value) loadWtJob(e.target.value); }}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#141b2d] border border-[#1e2d40] text-gray-100 text-sm font-mono focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="">— WT Job 선택 —</option>
                {allJobs
                  .filter(j => j.jobId !== jobId && j.mutationCount === 0)
                  .map(j => (
                    <option key={j.jobId} value={j.jobId}>
                      {j.jobId} · {j.mutationLabel} ({j.completedCount}/{j.inhibitorCount} 완료) [{new Date(j.createdAt).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}]
                    </option>
                  ))
                }
              </select>
            ) : (
              <input
                type="text"
                placeholder="WT Job ID 직접 입력 (예: AF3-MPRO-260722-161748)"
                value={wtJobInput}
                onChange={(e) => setWtJobInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadWtJob(wtJobInput)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#141b2d] border border-[#1e2d40] text-gray-100 text-sm font-mono focus:outline-none focus:border-cyan-500 transition-colors"
              />
            )}
            <button
              type="button"
              onClick={() => loadWtJob(wtJobInput)}
              disabled={wtJobLoading || !wtJobInput.trim()}
              className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {wtJobLoading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "로드"}
            </button>
            <button
              type="button"
              onClick={syncWslJobs}
              disabled={syncLoading}
              title="WSL 엔진에 저장된 과거 완료 잡을 드롭다운에 추가합니다"
              className="px-3 py-2 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {syncLoading
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : "🔄 WSL 동기화"
              }
            </button>
          </div>
          {syncMessage && (
            <p className={`text-xs mt-2 font-mono ${syncMessage.startsWith('동기화 실패') ? 'text-rose-400' : 'text-indigo-300'}`}>
              {syncMessage}
            </p>
          )}
          {wtJobError && <p className="text-xs text-rose-400 mt-2 font-mono">{wtJobError}</p>}
          {wtJob && !wtJobError && (
            <p className="text-xs text-emerald-400 mt-2">✓ WT Job 로드 완료: {wtJobId} — {allJobs.find(j => j.jobId === wtJobId)?.mutationLabel ?? ""}</p>
          )}
          {!wtJob && !wtJobError && allJobs.filter(j => j.jobId !== jobId).length === 0 && (
            <p className="text-xs text-amber-400 mt-2">⚠ 현재 세션에 비교 가능한 다른 Job이 없습니다. 아래 🔄 WSL 동기화 버튼을 눌러 과거 완료 잡을 불러오세요.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* WT 패널 */}
        {wtJob ? (
          <AnalysisPanel title="야생형 (Wild-Type)" subtitle={`WT Mpro + 억제제 · ${wtJobId}`} accentClass="border-emerald-700/60 bg-emerald-950/20 text-emerald-300"
            job={wtJob}
            fallbackInhibitors={mutJob?.inhibitors}
            selectedInhibitor={wtInhibitor}
            onSelectInhibitor={(id) => {
              // WT 억제제 변경 → Mutant도 동일 억제제로 동기화 (비교는 항상 같은 억제제)
              setWtInhibitor(id); setWtResult(null);
              setMutInhibitor(id); setMutResult(null);
            }}
            analysisResult={wtResult} analyzing={wtAnalyzing} analyzeError={wtError}
            onAnalyze={() => {
              if (!wtJob) return;
              // WT 패널: wtJob 에 억제제가 없으면 mutJob의 억제제를 이용하되, 경로는 WT job ID 기반으로 재구성
              const sourceJob = (wtJob.inhibitors?.length ?? 0) > 0 ? wtJob : (mutJob ?? wtJob);
              runAnalyze(sourceJob, wtInhibitor, setWtAnalyzing, setWtResult, setWtError, mutJob?.jobId ?? wtJobId, wtJobId);
            }}
            expandedAnchor={wtExpandedAnchor} setExpandedAnchor={setWtExpandedAnchor}
            expandedHbond={wtExpandedHbond} setExpandedHbond={setWtExpandedHbond} />
        ) : (
          <div className="flex-1 min-w-0">
            <div className="rounded-xl p-4 border border-emerald-700/60 bg-emerald-950/20 text-emerald-300 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5 opacity-70">WT Mpro + 억제제</p>
              <h2 className="text-lg font-bold">야생형 (Wild-Type)</h2>
            </div>
            <div className="card-base p-8 bg-[#0b1020] border-[#1e2d40] flex flex-col items-center text-center gap-3">
              <FlipHorizontal className="w-10 h-10 text-gray-600" />
              <p className="text-sm text-gray-500">위에서 WT Job ID를 입력하고 [로드] 버튼을 클릭하세요.</p>
            </div>
          </div>
        )}
        <div className="hidden lg:flex flex-col items-center gap-2 py-8">
          <div className="w-px flex-1 bg-[#1e2d40]" />
          <span className="text-xs text-gray-600 font-mono px-2 py-1 border border-[#1e2d40] rounded">vs</span>
          <div className="w-px flex-1 bg-[#1e2d40]" />
        </div>
        <AnalysisPanel title="변이형 (Mutant)" subtitle={`변이 Mpro + 억제제 · ${jobId}`} accentClass="border-cyan-700/60 bg-cyan-950/20 text-cyan-300"
          job={mutJob} selectedInhibitor={mutInhibitor}
          onSelectInhibitor={(id) => {
            // Mutant 억제제 변경 → WT도 동일 억제제로 동기화 (비교는 항상 같은 억제제)
            setMutInhibitor(id); setMutResult(null);
            setWtInhibitor(id); setWtResult(null);
          }}
          analysisResult={mutResult} analyzing={mutAnalyzing} analyzeError={mutError}
          onAnalyze={() => mutJob && runAnalyze(mutJob, mutInhibitor, setMutAnalyzing, setMutResult, setMutError, jobId!)}
          expandedAnchor={mutExpandedAnchor} setExpandedAnchor={setMutExpandedAnchor}
          expandedHbond={mutExpandedHbond} setExpandedHbond={setMutExpandedHbond} />
      </div>

      {wtResult && mutResult && <ComparisonSummary wt={wtResult} mut={mutResult} />}

      <div className="flex justify-between items-center flex-wrap gap-3 pt-2 border-t border-[#243047]">
        {/* Step 7: 분자 구조 하이라이트 버튼 */}
        {(mutResult || wtResult) && mutInhibitor && (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('mutJobId', jobId ?? '');
              if (wtJobId) params.set('wtJobId', wtJobId);
              params.set('inhibitorId', mutInhibitor);
              navigate(`/molecule?${params.toString()}`);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 font-bold text-sm transition-colors"
          >
            <FlaskConical className="w-4 h-4" />
            결합 취약부 2D 시각화 보기
          </button>
        )}
        <button type="button" onClick={() => navigate(`/optimization?jobId=${jobId}&inhibitor=${mutInhibitor || wtInhibitor}`)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors ml-auto shadow-lg shadow-indigo-900/20">
          다음 단계: 유도체 설계 (STAGE 3) <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InteractionComparisonPage;
