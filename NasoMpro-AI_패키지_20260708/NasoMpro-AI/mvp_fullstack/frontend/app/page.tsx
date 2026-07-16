"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StatCard } from "@/components/StatCard";
import { ScoreBadge } from "@/components/ScoreBadge";
import { api, Dashboard } from "@/lib/api";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDashboard().then(setDashboard).catch((err) => setError(err.message));
  }, []);

  return (
    <Shell>
      <div className="space-y-8">
        <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold text-slate-300">MVP Scope</p>
          <h2 className="mt-2 text-2xl font-bold">SARS-CoV-2 Mpro–ligand 분석 기반 연구 우선순위 대시보드</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            후보물질 점수화와 교차검증 리포트를 통해 연구기획 의사결정을 지원합니다. 실제 임상·투여·합성 지침은 제공하지 않습니다.
          </p>
        </section>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Targets" value={dashboard?.target_count ?? "..."} />
          <StatCard label="Complex Records" value={dashboard?.complex_count ?? "..."} />
          <StatCard label="Candidates" value={dashboard?.candidate_count ?? "..."} />
          <StatCard
            label="Avg Priority"
            value={dashboard?.average_research_priority_score?.toFixed(1) ?? "N/A"}
            helper="research-priority only"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">최근 점수화 결과</h3>
            <div className="mt-4 space-y-3">
              {(dashboard?.recent_scoring_results ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="font-medium">Candidate #{item.candidate_id}</p>
                    <p className="text-xs text-slate-500">Target fit {item.target_fit_score.toFixed(1)} · Risk penalty {item.risk_penalty.toFixed(1)}</p>
                  </div>
                  <ScoreBadge score={item.research_priority_score} />
                </div>
              ))}
              {dashboard?.recent_scoring_results.length === 0 ? <p className="text-sm text-slate-500">아직 점수화 결과가 없습니다.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">최근 검증 리포트</h3>
            <div className="mt-4 space-y-3">
              {(dashboard?.recent_validation_reports ?? []).map((report) => (
                <div key={report.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{report.model_name}</p>
                    <span className="text-xs text-slate-500">n={report.dataset_size}, k={report.folds}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">MAE {report.mae ?? "N/A"} · RMSE {report.rmse ?? "N/A"} · R² {report.r2 ?? "N/A"}</p>
                </div>
              ))}
              {dashboard?.recent_validation_reports.length === 0 ? <p className="text-sm text-slate-500">아직 검증 리포트가 없습니다.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
