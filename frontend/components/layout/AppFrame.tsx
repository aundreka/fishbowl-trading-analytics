"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const primaryNavigation = [
  { href: "/", label: "Dashboard" },
  { href: "/analytics", label: "Performance" },
];

const strategyNavigation = [
  { href: "/backtest", label: "Backtesting", badge: "Core" },
  { href: "/strategies", label: "Strategy Builder" },
  { href: "/data-upload", label: "Optimization" },
];

const analysisNavigation = [
  { href: "/assets", label: "Asset Universe" },
  { href: "/trades", label: "Trade Journal" },
  { href: "/users", label: "Admin Panel" },
];

function NavGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: Array<{ href: string; label: string; badge?: string }>;
  pathname: string;
}) {
  return (
    <div className="navGroup">
      <p>{title}</p>
      <div className="navList">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={active ? "navItem active" : "navItem"}>
              <span>{item.label}</span>
              {item.badge ? <small>{item.badge}</small> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const authRoute = pathname === "/login";

  if (authRoute) {
    return <div className="authViewport">{children}</div>;
  }

  return (
    <div className="platformShell">
      <aside className="platformSidebar">
        <div className="brandBlock">
          <div className="brandMark">FB</div>
          <div>
            <strong>Fishbowl</strong>
            <span>Trading Analytics</span>
          </div>
        </div>

        <NavGroup title="Overview" items={primaryNavigation} pathname={pathname} />
        <NavGroup title="Strategy Lab" items={strategyNavigation} pathname={pathname} />
        <NavGroup title="Analysis" items={analysisNavigation} pathname={pathname} />

        <div className="sidebarFooter">
          <p>Demo Access</p>
          <span>admin@fishbowl.local</span>
          <span>fishbowl123</span>
        </div>
      </aside>

      <div className="platformMain">
        <header className="platformTopbar">
          <div>
            <p className="topbarLabel">Simulation Workspace</p>
            <h1>{pathname === "/" ? "Dashboard" : pathname.replace("/", "").replace("-", " ")}</h1>
          </div>
          <div className="topbarActions">
            <span className="statusPill">Live market data off</span>
            <Link href="/backtest" className="actionButton">
              New Backtest
            </Link>
          </div>
        </header>
        <main className="platformContent">{children}</main>
      </div>
    </div>
  );
}
