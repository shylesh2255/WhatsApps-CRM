"use client";

import { useEffect, useState } from "react";
import { usePlatformOwnerGuard } from "@/hooks/use-platform-owner-guard";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, Loader2, Megaphone, ChevronUp, ChevronDown } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface AdBanner {
  id: string;
  company_name: string;
  title: string | null;
  description: string | null;
  image_url: string;
  link_url: string | null;
  active: boolean;
  position: number;
  display_duration_seconds: number;
}

export default function AdminAdsPage() {
  usePlatformOwnerGuard();
  const supabase = createClient();
  const { profile } = useAuth();

  const [ads, setAds] = useState<AdBanner[]>([]);
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("30");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/ads", { cache: "no-store" });
    const result = await res.json();
    if (res.ok) {
      const loaded = (result.ads ?? []) as AdBanner[];
      setAds(loaded);
      setDurationDrafts(Object.fromEntries(loaded.map((a) => [a.id, String(a.display_duration_seconds)])));
    }
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !imageFile) {
      toast.error("Company name and an image are required");
      return;
    }
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("ad-banners")
        .upload(fileName, imageFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("ad-banners").getPublicUrl(fileName);

      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          imageUrl: urlData.publicUrl,
          linkUrl: linkUrl.trim() || undefined,
          position: ads.length,
          durationSeconds: parseInt(durationSeconds, 10) || 30,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success("Ad banner added");
      setCompanyName("");
      setTitle("");
      setDescription("");
      setLinkUrl("");
      setDurationSeconds("30");
      setImageFile(null);
      setImagePreview("");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add ad banner");
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(ad: AdBanner) {
    const res = await fetch(`/api/admin/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !ad.active }),
    });
    if (res.ok) load();
  }

  async function updateDuration(ad: AdBanner, value: string) {
    const seconds = parseInt(value, 10);
    if (!seconds || seconds < 3 || seconds > 300) return;
    const res = await fetch(`/api/admin/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds: seconds }),
    });
    if (res.ok) load();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ads.length) return;
    setReordering(true);
    const a = ads[index];
    const b = ads[target];
    await Promise.all([
      fetch(`/api/admin/ads/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: b.position }),
      }),
      fetch(`/api/admin/ads/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: a.position }),
      }),
    ]);
    setReordering(false);
    load();
  }

  async function remove(ad: AdBanner) {
    if (!confirm(`Delete the "${ad.company_name}" ad banner?`)) return;
    const res = await fetch(`/api/admin/ads/${ad.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Ad banner deleted");
      load();
    }
  }

  if (!profile) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ad Banners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sponsor banners shown only to <strong>viewer</strong>-role users, across every customer account.
          Multiple active banners rotate automatically as a slider, in the order below.
        </p>
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-lg">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Add a banner
        </h2>

        <div
          role="button"
          tabIndex={0}
          onClick={() => document.getElementById("ad-image-input")?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 hover:bg-muted/40"
        >
          {imagePreview ? (
            <div className="relative h-24 w-full">
              <Image src={imagePreview} alt="Preview" fill className="object-contain" />
            </div>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload banner image (max 5MB)</span>
              <span className="text-xs text-muted-foreground">Recommended: 1200 &times; 300px (4:1 landscape)</span>
            </>
          )}
        </div>
        <input id="ad-image-input" type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

        <div>
          <Label htmlFor="companyName">Company name *</Label>
          <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g., Acme Supplies" />
        </div>
        <div>
          <Label htmlFor="title">Title (optional)</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., 50% off this month" />
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short supporting text" />
        </div>
        <div>
          <Label htmlFor="linkUrl">Link URL (optional)</Label>
          <Input id="linkUrl" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <div>
          <Label htmlFor="duration">Display duration (seconds)</Label>
          <Input id="duration" type="number" min={3} max={300} value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} />
        </div>

        <Button type="submit" disabled={uploading} className="w-full">
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {uploading ? "Adding..." : "Add Banner"}
        </Button>
      </form>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : ads.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No ad banners yet. Add one above.
          </div>
        ) : (
          ads.map((ad, index) => (
            <div key={ad.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  disabled={reordering || index === 0}
                  onClick={() => move(index, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={reordering || index === ads.length - 1}
                  onClick={() => move(index, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image src={ad.image_url} alt={ad.company_name} fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{ad.company_name}</p>
                {ad.title && <p className="text-xs text-foreground truncate">{ad.title}</p>}
                {ad.description && <p className="text-xs text-muted-foreground truncate">{ad.description}</p>}
                {ad.link_url && <p className="text-xs text-muted-foreground truncate">{ad.link_url}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={3}
                    max={300}
                    value={durationDrafts[ad.id] ?? String(ad.display_duration_seconds)}
                    onChange={(e) => setDurationDrafts((prev) => ({ ...prev, [ad.id]: e.target.value }))}
                    onBlur={(e) => updateDuration(ad, e.target.value)}
                    className="h-8 w-16 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
                <Switch checked={ad.active} onCheckedChange={() => toggleActive(ad)} />
                <span className="text-xs text-muted-foreground w-10">{ad.active ? "Active" : "Off"}</span>
                <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300" onClick={() => remove(ad)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
