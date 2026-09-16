"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface AdBanner {
  id: string;
  company_name: string;
  title: string | null;
  description: string | null;
  image_url: string;
  link_url: string | null;
  display_duration_seconds: number;
}

const FADE_MS = 400;

export function AdBannerDisplay() {
  const supabase = createClient();
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const { data } = await supabase
          .from("ad_banners")
          .select("id, company_name, title, description, image_url, link_url, display_duration_seconds")
          .eq("active", true)
          .order("position");
        setAds((data ?? []) as AdBanner[]);
      })();
    });
  }, [supabase]);

  useEffect(() => {
    if (ads.length < 2) return;
    const current = ads[index];
    const durationMs = Math.max(3, current?.display_duration_seconds ?? 30) * 1000;

    timerRef.current = setTimeout(() => {
      setVisible(false); // start fade-out
      setTimeout(() => {
        setIndex((i) => (i + 1) % ads.length);
        setVisible(true); // fade-in the next banner
      }, FADE_MS);
    }, durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ads, index]);

  if (ads.length === 0) return null;
  const ad = ads[Math.min(index, ads.length - 1)];

  const content = (
    <>
      <div className="relative h-40 w-full overflow-hidden rounded-lg bg-muted sm:h-48">
        <Image src={ad.image_url} alt={ad.company_name} fill className="object-cover" sizes="(min-width: 1024px) 800px, 100vw" />
      </div>
      <div className="mt-3">
        {ad.title && <p className="text-sm font-medium text-foreground">{ad.title}</p>}
        {ad.description && <p className="mt-0.5 text-sm text-muted-foreground">{ad.description}</p>}
      </div>
    </>
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sponsored &middot; {ad.company_name}
        </p>
        {ads.length > 1 && (
          <div className="flex gap-1">
            {ads.map((a, i) => (
              <span
                key={a.id}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === index ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
        )}
      </header>
      <div
        className="transition-opacity ease-in-out"
        style={{ transitionDuration: `${FADE_MS}ms`, opacity: visible ? 1 : 0 }}
      >
        {ad.link_url ? (
          <a href={ad.link_url} target="_blank" rel="noopener noreferrer nofollow sponsored" className="block">
            {content}
          </a>
        ) : (
          <div>{content}</div>
        )}
      </div>
    </section>
  );
}
