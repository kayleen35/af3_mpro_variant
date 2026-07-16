import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/candidates", label: "Candidates" },
  { href: "/agent", label: "Agent" },
  { href: "/complexes", label: "Complexes" },
  { href: "/validation", label: "Validation" },
  { href: "/admin", label: "Admin" }
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Research Decision Support</p>
            <h1 className="text-xl font-bold">AI 신약개발 의사결정 지원 MVP</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm font-medium">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
            <a href="/pwa/index.html" target="_blank" rel="noopener"
               className="rounded-full bg-teal-600 px-3 py-2 font-semibold text-white hover:bg-teal-700">
              오프라인 PWA ↗
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-6 pb-8 text-xs text-slate-500">
        연구지원용 플랫폼입니다. 임상, 투여, 합성, 치료 지침을 제공하지 않습니다.
      </footer>
    </div>
  );
}
