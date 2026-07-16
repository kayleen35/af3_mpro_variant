"use client";

import { FormEvent, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, ComplexRecord, Target } from "@/lib/api";

const initialForm = {
  target_id: 1,
  ligand_name: "",
  ligand_smiles: "",
  pdb_id: "",
  docking_score: -6.5,
  binding_affinity_nm: 1000,
  molecular_weight: 350,
  logp: 2,
  hbond_donors: 1,
  hbond_acceptors: 4,
  tpsa: 75,
  data_source: "internal research dataset",
  assay_type: "activity label proxy",
  observed_activity_label: "moderate",
  notes: ""
};

export default function ComplexesPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [records, setRecords] = useState<ComplexRecord[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [targetList, recordList] = await Promise.all([api.listTargets(), api.listComplexes()]);
    setTargets(targetList);
    setRecords(recordList);
  };

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await api.createComplex(form);
    setForm(initialForm);
    setMessage("Complex record가 등록되었습니다.");
    await refresh();
  };

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Mpro–ligand complex 데이터 등록</h2>
          <p className="mt-1 text-sm text-slate-500">검증과 분석용 메타데이터만 입력합니다.</p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.target_id} onChange={(e) => setForm({ ...form, target_id: Number(e.target.value) })}>
              {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
            </select>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Ligand name" value={form.ligand_name} onChange={(e) => setForm({ ...form, ligand_name: e.target.value })} required />
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Ligand SMILES or identifier" value={form.ligand_smiles} onChange={(e) => setForm({ ...form, ligand_smiles: e.target.value })} />
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="PDB ID" value={form.pdb_id} onChange={(e) => setForm({ ...form, pdb_id: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Docking" value={form.docking_score} onChange={(v) => setForm({ ...form, docking_score: v })} />
              <NumberInput label="Affinity nM" value={form.binding_affinity_nm} onChange={(v) => setForm({ ...form, binding_affinity_nm: v })} />
              <NumberInput label="MW" value={form.molecular_weight} onChange={(v) => setForm({ ...form, molecular_weight: v })} />
              <NumberInput label="logP" value={form.logp} onChange={(v) => setForm({ ...form, logp: v })} />
              <NumberInput label="H donors" value={form.hbond_donors} onChange={(v) => setForm({ ...form, hbond_donors: v })} />
              <NumberInput label="H acceptors" value={form.hbond_acceptors} onChange={(v) => setForm({ ...form, hbond_acceptors: v })} />
              <NumberInput label="TPSA" value={form.tpsa} onChange={(v) => setForm({ ...form, tpsa: v })} />
            </div>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.observed_activity_label} onChange={(e) => setForm({ ...form, observed_activity_label: e.target.value })}>
              <option value="active">active</option>
              <option value="moderate">moderate</option>
              <option value="inactive">inactive</option>
            </select>
            <button className="w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">등록</button>
          </form>
          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Complex records</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2">Ligand</th>
                  <th className="p-2">PDB</th>
                  <th className="p-2">Docking</th>
                  <th className="p-2">Affinity</th>
                  <th className="p-2">Label</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{record.ligand_name}</td>
                    <td className="p-2">{record.pdb_id ?? "N/A"}</td>
                    <td className="p-2">{record.docking_score ?? "N/A"}</td>
                    <td className="p-2">{record.binding_affinity_nm ?? "N/A"}</td>
                    <td className="p-2">{record.observed_activity_label ?? "N/A"}</td>
                  </tr>
                ))}
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
