export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">N/A</span>;
  }

  const label = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";

  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
      {label} · {score.toFixed(1)}
    </span>
  );
}
