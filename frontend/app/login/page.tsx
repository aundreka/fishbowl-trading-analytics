"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@fishbowl.local");
  const [password, setPassword] = useState("fishbowl123");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await apiFetch<{ token: string; user: { full_name: string; role: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("fishbowl-token", result.token);
      }
      setMessage(`Welcome back, ${result.user.full_name}. Redirecting...`);
      
      // Small delay to show success message before redirect
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    }
  }

  return (
    <section className="loginScene">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="loginLogo">FB</div>
          <strong>Fishbowl Trading Analytics</strong>
          <span>Strategy / Backtest / Evaluate</span>
        </div>

        <form className="loginForm" onSubmit={handleSubmit}>
          <label>
            Email address
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@institution.com" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="************"
            />
          </label>
          <div className="loginRow">
            <span>Remember me</span>
            <a href="#">Forgot password?</a>
          </div>
          <button type="submit" className="loginPrimary">
            Sign in to dashboard
          </button>
          <div className="loginDivider">OR</div>
          <button type="button" className="ghostButton">
            Continue with SSO
          </button>
          <button type="button" className="ghostButton">
            Continue with Google Workspace
          </button>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="errorText">{error}</p> : null}
      </div>
    </section>
  );
}
