"use client";

import { FormEvent, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { api, Candidate, ScoringResult, Target } from "@/lib/api";

const initialForm = {
  name: "",
  smiles: "",
  target_id: 1,
  molecular_weight: 350,
  logp: 2.5,
  docking_score: -7.0,
  binding_affinity_nm: 500,
  admet_risk_score: 0.35,
  novelty_score: 0.55,
  data_quality_score: 0.75,
  status: "research",
  notes: ""
};

export default function CandidatesPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [latestResults, setLatestResults] = useState<Record<number, ScoringResult>>({});
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [targetList, candidateList, resultList] = await Promise.all([
      api.listTargets(),
      api.listCandidates(),
      api.listScoringResults()
    ]);
    setTargets(targetList);
    setCandidates(candidateList);
    const byCandidate: Record<number, ScoringResult> = {};
    resultList.forEach((result) => {
      if (!byCandidate[result.candidate_id]) byCandidate[result.candidate_id] = result;
    });
    setLatestResults(byCandidate);
  };

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await api.createCandidate(form);
    setForm(initialForm);
    setMessage("후보물질이 등록되었습니다.");
    await refresh();
  };

  const handleScore = async (candidateId: number) => {
    const result = await api.scoreCandidate(candidateId);
    setLatestResults((prev) => ({ ...prev, [candidateId]: result }));
    setMessage(`Candidate #${candidateId} 점수화가 완료되었습니다.`);
  };

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">후보물질 등록</h2>
          <p className="mt-1 text-sm text-slate-500">연구 우선순위 점수화를 위한 최소 속성을 입력합니다.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="SMILES or identifier" value={form.smiles} onChange={(e) => setForm({ ...form, smiles: e.target.value })} />
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.target_id} onChange={(e) => setForm({ ...form, target_id: Number(e.target.value) })}>
              {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="MW" value={form.molecular_weight} onChange={(v) => setForm({ ...form, molecular_weight: v })} />
              <NumberInput label="logP" value={form.logp} onChange={(v) => setForm({ ...form, logp: v })} />
              <NumberInput label="Docking" value={form.docking_score} onChange={(v) => setForm({ ...form, docking_score: v })} />
              <NumberInput label="Affinity nM" value={form.binding_affinity_nm} onChange={(v) => setForm({ ...form, binding_affinity_nm: v })} />
              <NumberInput label="ADMET risk 0-1" value={form.admet_risk_score} onChange={(v) => setForm({ ...form, admet_risk_score: v })} />
              <NumberInput label="Novelty 0-1" value={form.novelty_score} onChange={(v) => setForm({ ...form, novelty_score: v })} />
              <NumberInput label="Quality 0-1" value={form.data_quality_score} onChange={(v) => setForm({ ...form, data_quality_score: v })} />
            </div>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">등록</button>
          </form>
          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">후보물질 목록</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">예측 pIC50 (ML)</th>
                  <th className="p-2">Mpro결합</th>
                  <th className="p-2">비강</th>
                  <th className="p-2">Priority</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => {
                  const r = latestResults[candidate.id];
                  return (
                  <tr key={candidate.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{candidate.name}</td>
                    <td className="p-2 font-semibold text-teal-700">{r?.predicted_pic50 != null ? r.predicted_pic50.toFixed(2) : "—"}</td>
                    <td className="p-2">{r?.mpro_binding_score != null ? r.mpro_binding_score.toFixed(0) : "—"}</td>
                    <td className="p-2">{r?.nasal_delivery_score != null ? r.nasal_delivery_score.toFixed(0) : "—"}</td>
                    <td className="p-2"><ScoreBadge score={r?.research_priority_score} /></td>
                    <td className="p-2">
                      <button onClick={() => handleScore(candidate.id)} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold hover:bg-slate-200">Score</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs font-medium text-slate-500">
      {label}
      <input type="number" step="any" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
