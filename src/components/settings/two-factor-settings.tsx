"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Factor {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  status: string;
}

export function TwoFactorSettings() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors([...data.totp] as Factor[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => void loadFactors());
  }, []);

  async function startEnroll() {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      toast.error(error?.message || "Unable to start 2FA setup");
      setEnrolling(false);
      return;
    }
    setFactorId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  function cancelEnroll() {
    setEnrolling(false);
    setFactorId(null);
    setQrSvg(null);
    setSecret(null);
    setCode("");
  }

  async function confirmEnroll() {
    if (!factorId || code.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw challengeError ?? new Error("Challenge failed");
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;
      toast.success("Two-factor authentication enabled");
      cancelEnroll();
      loadFactors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid code, try again");
    } finally {
      setVerifying(false);
    }
  }

  async function removeFactor(id: string) {
    if (!confirm("Remove this authenticator? You'll no longer be asked for a code at sign-in.")) return;
    setRemovingId(id);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setRemovingId(null);
    if (error) {
      toast.error(error.message || "Unable to remove authenticator");
      return;
    }
    toast.success("Authenticator removed");
    loadFactors();
  }

  const verifiedFactor = factors.find((f) => f.status === "verified");

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground">Two-factor authentication</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Add an authenticator app (Google Authenticator, 1Password, Authy, etc.) as a second sign-in step.
      </p>

      {verifiedFactor && !enrolling && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span>{verifiedFactor.friendly_name || "Authenticator app"} — active</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-red-400 hover:text-red-300"
            disabled={removingId === verifiedFactor.id}
            onClick={() => removeFactor(verifiedFactor.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      )}

      {!verifiedFactor && !enrolling && (
        <Button className="mt-4" onClick={startEnroll}>
          Enable 2FA
        </Button>
      )}

      {enrolling && (
        <div className="mt-4 space-y-4">
          {qrSvg && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-white p-4">
              <div className="h-40 w-40" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              {secret && (
                <p className="text-center text-xs text-muted-foreground">
                  Or enter this key manually: <span className="font-mono">{secret}</span>
                </p>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="totp-code">Enter the 6-digit code from your app</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="mt-1 max-w-[160px]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEnroll} disabled={verifying}>
              Cancel
            </Button>
            <Button onClick={confirmEnroll} disabled={verifying || code.length !== 6}>
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & Enable
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
