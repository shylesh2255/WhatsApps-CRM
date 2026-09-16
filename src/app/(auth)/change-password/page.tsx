"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!currentPassword || password.length < 8 || password !== confirmation) {
      setError("Enter your current password, then use at least 8 characters for the new password and make both passwords match.");
      return;
    }
    setLoading(true);
    const { data: currentUser } = await supabase.auth.getUser();
    const email = currentUser.user?.email;
    if (!email) {
      setError("Your session has expired. Please sign in again.");
      setLoading(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      setError("Current password is incorrect.");
      setLoading(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
    if (profileError) {
      setError("Password changed, but your account status could not be updated. Contact an administrator.");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader><CardTitle>Change your password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
            <div className="flex flex-col gap-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="confirmation">Confirm password</Label><Input id="confirmation" type="password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
            <Button type="submit" disabled={loading}>{loading ? "Updating..." : "Update password"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}