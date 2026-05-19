"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("fishbowl-token") : null;
    const isAuthRoute = pathname === "/login";

    if (!token && !isAuthRoute) {
      router.push("/login");
    } else if (token && isAuthRoute) {
      router.push("/");
    } else {
      setAuthenticated(!!token || isAuthRoute);
    }
    setLoading(false);
  }, [pathname, router]);

  if (loading) {
    return <div className="platformPanel">Loading authentication...</div>;
  }

  // If not authenticated and not on login page, we are redirecting, so show nothing
  if (!authenticated && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
