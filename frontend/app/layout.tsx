import "../styles/globals.css";
import { AppFrame } from "../components/layout/AppFrame";
import { AuthGuard } from "../components/auth/AuthGuard";

export const metadata = {
  title: "Fishbowl Trading Analytics",
  description: "Trading strategy backtesting dashboard for students and aspiring traders.",
};

export default function RootLayout({ children }: { children: import("react").ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          <AppFrame>{children}</AppFrame>
        </AuthGuard>
      </body>
    </html>
  );
}
