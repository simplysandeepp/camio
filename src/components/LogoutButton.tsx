"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      // If network fails, they might still be logged in locally/server,
      // but let them retry instead of locking the button.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn secondary" onClick={logout} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
