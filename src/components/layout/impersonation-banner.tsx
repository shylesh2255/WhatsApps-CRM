"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UserCog } from "lucide-react";
import {
  readActiveImpersonation,
  readReturnSession,
  clearImpersonation,
  type ActiveImpersonation,
} from "@/lib/impersonation/storage";

export function ImpersonationBanner() {
  const router = useRouter();
  const supabase = createClient();
  const [active, setActive] = useState<ActiveImpersonation | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setActive(readActiveImpersonation()));
  }, []);

  if (!active) return null;

  async function handleExit() {
    if (!active) return;
    setExiting(true);
    const returnSession = readReturnSession();
    if (returnSession) {
      await supabase.auth.setSession(returnSession);
    }
    // Best-effort audit close-out — now running as the restored owner.
    await fetch(`/api/admin/customers/${active.targetUserId}/impersonate`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startedAt: active.startedAt }),
    }).catch(() => {});
    clearImpersonation();
    router.replace("/customers");
    router.refresh();
  }

  return (
    <div className="print:hidden flex shrink-0 items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <UserCog className="h-4 w-4" />
      <span>Viewing as {active.targetName} (impersonating)</span>
      <button
        type="button"
        onClick={handleExit}
        disabled={exiting}
        className="rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold hover:bg-amber-950/20 disabled:opacity-50"
      >
        {exiting ? "Exiting..." : "Exit impersonation"}
      </button>
    </div>
  );
}
