"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, QsarSummary, Target, ValidationReport } from "@/lib/api";

export default function ValidationPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState<number | undefined>(undefined);
  const [reports, setReports] = useState<ValidationReport[]>([]);
  const [qsar, setQsar] = useState<QsarSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [targetList, reportList] = await Promise.all([api.listTargets(), api.listValidationReports()]);
    setTargets(targetList);
    setReports(reportList);
    if (targetList[0] && targetId === undefined) setTargetId(targetList[0].id);
  };

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    api.getQsarSummary().then(setQsar).catch(() => undefined);
  }, []);

  const runValidation = async () => {
    const report = await api.runCrossValidation(targetId);
    setMessage(`검증 리포트 #${report.id} 생성 완료`);
    await refresh();
  };

  return (
    <Shell>
      <div className="space-y-6">
        {qsar ? (
          <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
            <h2 className="text-lg font-bold">QSAR 모델 검증 (실측 {qsar.n_compounds.toLocaleString()}종 · scaffold-CV)</h2>
            <p className="mt-1 text-sm text-slate-600">Murcko 골격 {qsar.n_scaffolds.toLocaleString()}개 단위 5-fold GroupKFold — 학습에 쓰이지 않은 분자에 대한 정직한 일반화 성능.</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Metric label="RandomForest (서버)" value={`ρ=${qsar.random_forest.spearman.toFixed(2)}`} sub={`R²=${qsar.random_forest.r2.toFixed(2)}`} strong />
              <Metric label="Ridge 선형 (브라우저)" value={`ρ=${qsar.ridge_linear_js.spearman.toFixed(2)}`} sub={`R²=${qsar.ridge_linear_js.r2.toFixed(2)}`} />
              <Metric label="유사도 베이스라인" value={`ρ=${qsar.similarity_baseline.spearman.toFixed(2)}`} sub="기존" />
            </div>
            <p className="mt-3 text-xs text-slate-500">{qsar.features} · {qsar.scope_note}</p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">교차검증 실행</h2>
          <p className="mt-1 text-sm text-slate-500">내부 labeled complex record 기반의 MVP 검증 지표를 생성합니다.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select className="rounded-xl border border-slate-200 px-3 py-2" value={targetId} onChange={(e) => setTargetId(Number(e.target.value))}>
              {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
            </select>
            <button onClick={runValidation} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">Run K-fold validation</button>
          </div>
          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">검증 리포트 목록</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {reports.map((report) => (
              <article key={report.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{report.model_name}</h3>
                  <span className="text-xs text-slate-500">#{report.id}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{report.summary}</p>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-white p-2"><dt className="text-xs text-slate-500">n</dt><dd className="font-bold">{report.dataset_size}</dd></div>
                  <div className="rounded-xl bg-white p-2"><dt className="text-xs text-slate-500">k</dt><dd className="font-bold">{report.folds}</dd></div>
                  <div className="rounded-xl bg-white p-2"><dt className="text-xs text-slate-500">MAE</dt><dd className="font-bold">{report.mae ?? "N/A"}</dd></div>
                  <div className="rounded-xl bg-white p-2"><dt className="text-xs text-slate-500">R²</dt><dd className="font-bold">{report.r2 ?? "N/A"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Metric({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? "bg-teal-600 text-white" : "bg-white"}`}>
      <p className={`text-xs ${strong ? "text-teal-50" : "text-slate-500"}`}>{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub ? <p className={`text-xs ${strong ? "text-teal-50" : "text-slate-500"}`}>{sub}</p> : null}
    </div>
  );
}
