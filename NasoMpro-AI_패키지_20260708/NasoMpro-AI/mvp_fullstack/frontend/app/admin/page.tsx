"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, AuditLog } from "@/lib/api";

export default function AdminPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.listAuditLogs().then(setLogs).catch((err) => setMessage(err.message));
  }, []);

  return (
    <Shell>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">관리자 감사 로그</h2>
        <p className="mt-1 text-sm text-slate-500">데이터 생성, 점수화, 검증 실행 이력을 확인합니다.</p>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Action</th>
                <th className="p-2">Entity</th>
                <th className="p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="p-2 text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-2">{log.actor}</td>
                  <td className="p-2 font-medium">{log.action}</td>
                  <td className="p-2">{log.entity_type} #{log.entity_id ?? "-"}</td>
                  <td className="p-2">{log.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
