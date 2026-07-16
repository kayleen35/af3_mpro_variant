"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { api, AgentResult } from "@/lib/api";

const PRESETS: { label: string; smiles: string }[] = [
  { label: "GC376", smiles: "CC(C)C[C@@H](C(=O)N[C@@H](CC1CCNC1=O)C(O)S(=O)(=O)[O-])NC(=O)OCC2=CC=CC=C2.[Na+]" },
  { label: "Nirmatrelvir", smiles: "CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C" },
  { label: "약한 리드(Aspirin)", smiles: "CC(=O)Oc1ccccc1C(=O)O" }
];

export default function AgentPage() {
  const [smiles, setSmiles] = useState(PRESETS[0].smiles);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.optimizeAgent(smiles.trim(), 5));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">자율 에이전트 · 리드 최적화 파이프라인</h2>
          <p className="mt-1 text-sm text-slate-500">
            시드 SMILES를 입력하면 4개 에이전트가 가설수립 → QSAR 활성평가 → 도구기반 분자 최적화 루프 → 규제·제형 판정을 수행합니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => setSmiles(p.smiles)}
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold hover:bg-slate-200">{p.label} 시드</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={smiles} onChange={(e) => setSmiles(e.target.value)} spellCheck={false}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="시드 SMILES" />
            <button onClick={run} disabled={loading}
              className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              {loading ? "실행 중..." : "자율 최적화 실행"}
            </button>
          </div>
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
        </section>

        {result ? (
          <>
            <section className="grid gap-3 md:grid-cols-2">
              {result.agents.map((a, i) => (
                <article key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">{i + 1}</span>
                    <h3 className="font-bold">{a.name}</h3>
                    {a.tool ? <span className="ml-auto rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">{a.tool}</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{a.role}</p>
                </article>
              ))}
            </section>

            <section className="rounded-2xl border-2 border-teal-600 bg-teal-50 p-5">
              <h3 className="font-bold">🎯 최종 추천 후보 · {result.final_candidate.id}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Pill>예측 pIC50 {result.final_candidate.predicted_pic50.toFixed(2)}</Pill>
                {result.final_candidate.measured_pic50 != null ? <Pill>측정 pIC50 {result.final_candidate.measured_pic50.toFixed(2)}</Pill> : null}
                <Pill>비강 {result.final_candidate.nasal.toFixed(0)}</Pill>
                <Pill>활성 향상 {result.predicted_pic50_gain >= 0 ? "+" : ""}{result.predicted_pic50_gain.toFixed(2)}</Pill>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                시드(예측 {result.seed.predicted_pic50.toFixed(2)}) → 자율 탐색으로 예측 pIC50 {result.final_candidate.predicted_pic50.toFixed(2)} 후보 도출.
                {result.seed.structural_alerts.length ? ` 시드 구조알림: ${result.seed.structural_alerts.join(", ")}.` : ""}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold">최적화 트레이스 (hill-climb)</h3>
              <p className="mt-1 text-xs text-slate-500">측정 pIC50은 에이전트가 사용하지 않은 검증용 실측값입니다.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr><th className="p-2">R</th><th className="p-2">후보</th><th className="p-2">예측 pIC50</th><th className="p-2">측정 pIC50</th><th className="p-2">비강</th><th className="p-2">SAR유사도</th><th className="p-2">효용 U</th></tr>
                  </thead>
                  <tbody>
                    {result.trajectory.map((t, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2">{t.round}</td>
                        <td className="p-2 font-medium">{t.id}</td>
                        <td className={`p-2 font-semibold ${t.round > 0 && t.predicted_pic50 > result.trajectory[0].predicted_pic50 ? "text-teal-700" : ""}`}>{t.predicted_pic50.toFixed(2)}</td>
                        <td className="p-2">{t.measured_pic50 != null ? t.measured_pic50.toFixed(2) : "—"}</td>
                        <td className="p-2">{t.nasal.toFixed(0)}</td>
                        <td className="p-2">{t.similarity_to_anchor.toFixed(3)}</td>
                        <td className="p-2">{t.utility.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-400">{result.disclaimer}</p>
            </section>
          </>
        ) : null}
      </div>
    </Shell>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm">{children}</span>;
}
