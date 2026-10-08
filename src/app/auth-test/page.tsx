"use client";

import { useEffect, useState } from "react";

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

  // Google redirects back here after the OAuth dance — show whatever
  // session (or error) that landed us with, without needing another click.
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) {
      setResult(`google sign-in redirected back with an error: ${error}`);
      return;
    }
    fetch("/api/auth/get-session", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (body) setResult(JSON.stringify({ session: body }, null, 2));
      })
      .catch(() => {});
  }, []);

  async function signInWithGoogle() {
    setPending(true);
    setResult("redirecting to Google...");
    try {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider: "google", callbackURL: "/auth-test" }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setResult(`sign-in/social failed (${res.status}): ${JSON.stringify(body)}`);
        setPending(false);
        return;
      }
      window.location.href = body.url;
    } catch (err) {
      setResult(`error: ${err instanceof Error ? err.message : String(err)}`);
      setPending(false);
    }
  }

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
    <div
      style={{
        maxWidth: 480,
        margin: "40px auto",
        padding: 16,
        fontFamily: "monospace",
        // The site's dark theme leaks in here otherwise (light text on a
        // light <pre> background, unreadable) — force plain light-mode
        // colors regardless of it, this page doesn't need to match.
        background: "#fff",
        color: "#111",
      }}
    >
      <h1>Better Auth — тестовый вход (временная страница)</h1>
      <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ color: "#111", background: "#fff" }}
        />
        <input
          type="password"
          placeholder="пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ color: "#111", background: "#fff" }}
        />
        <button type="submit" disabled={pending}>
          {pending ? "..." : "Войти"}
        </button>
      </form>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={pending}
        style={{ marginTop: 8, width: "100%" }}
      >
        Войти через Google
      </button>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          marginTop: 16,
          background: "#eee",
          color: "#111",
          padding: 8,
        }}
      >
        {result}
      </pre>
    </div>
  );
}
