"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_OWNER_EMAIL } from "@/lib/auth/platform-owner";

/**
 * Redirects away from platform-wide Super Admin pages (customers,
 * subscriptions, support, reports) for anyone but the platform owner.
 * The underlying APIs already enforce this server-side via
 * `requirePlatformOwner()` — this just avoids rendering a page full of
 * 403s for a tenant admin who navigates here directly.
 */
export function usePlatformOwnerGuard() {
  const router = useRouter();
  const { profile, profileLoading } = useAuth();

  useEffect(() => {
    if (profileLoading) return;
    if (profile?.email?.toLowerCase() !== PLATFORM_OWNER_EMAIL) {
      router.replace("/dashboard");
    }
  }, [profile, profileLoading, router]);
}
