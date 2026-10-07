"use client";

import { useState } from "react";

// Throwaway page to confirm Better Auth actually authenticates a real,
// migrated account end to end — nothing on the live site links here, and
// it talks to /api/auth directly (no UI polish, this is a diagnostic, not
// a real sign-in page). Delete once the real cutover replaces the
// Supabase-based sign-in forms.
export default function AuthTestPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string>("");
  const [pending, setPending] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult("...");
    try {
      const signInRes = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const signInBody = await signInRes.json();
      if (!signInRes.ok) {
        setResult(`sign-in failed (${signInRes.status}): ${JSON.stringify(signInBody)}`);
        return;
      }

      const sessionRes = await fetch("/api/auth/get-session", { credentials: "include" });
      const sessionBody = await sessionRes.json();
      setResult(JSON.stringify({ signIn: signInBody, session: sessionBody }, null, 2));
    } catch (err) {
      setResult(`error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: 16, fontFamily: "monospace" }}>
      <h1>Better Auth — тестовый вход (временная страница)</h1>
      <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={pending}>
          {pending ? "..." : "Войти"}
        </button>
      </form>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 16, background: "#eee", padding: 8 }}>{result}</pre>
    </div>
  );
}
