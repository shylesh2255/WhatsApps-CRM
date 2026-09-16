"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { parseLeadCsv, type ParsedLeadRow } from "@/lib/leads/parse-lead-csv";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PREVIEW_LIMIT = 5;

interface LeadImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function LeadImportModal({ open, onOpenChange, onImported }: LeadImportModalProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedLeadRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  function reset() {
    setFile(null);
    setRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    const text = await selected.text();
    const { rows: parsed, hasFirstNameColumn } = parseLeadCsv(text);
    if (!hasFirstNameColumn) {
      toast.error("CSV must have a 'first_name' column");
      setRows([]);
      return;
    }
    if (parsed.length === 0) {
      toast.error("No valid rows found in this file");
      setRows([]);
      return;
    }
    setRows(parsed);
  }

  async function handleImport() {
    if (rows.length === 0 || !accountId) return;
    setImporting(true);
    let imported = 0;
    let failed = 0;

    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error, data } = await supabase
        .from("leads")
        .insert(
          chunk.map((row) => ({
            account_id: accountId,
            first_name: row.firstName,
            last_name: row.lastName ?? null,
            company_name: row.companyName ?? null,
            email: row.email ?? null,
            phone: row.phone ?? null,
            alternate_phone: row.alternatePhone ?? null,
            source: row.source && ["website", "referral", "whatsapp", "email", "phone", "advertisement", "social_media", "manual", "api"].includes(row.source) ? row.source : "manual",
            industry: row.industry ?? null,
            notes: row.notes ?? null,
          }))
        )
        .select("id");
      if (error) failed += chunk.length;
      else imported += data?.length ?? chunk.length;
    }

    setResult({ imported, failed });
    setImporting(false);
    if (imported > 0) {
      toast.success(`Imported ${imported} lead${imported === 1 ? "" : "s"}`);
      onImported();
    }
    if (failed > 0) toast.error(`${failed} row${failed === 1 ? "" : "s"} failed to import`);
  }

  const preview = rows.slice(0, PREVIEW_LIMIT);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 hover:bg-muted/40"
        >
          {file ? (
            <>
              <FileText className="h-6 w-6 text-primary" />
              <p className="text-sm font-medium">{file.name}</p>
              <span className="text-xs text-muted-foreground">{rows.length} rows ready</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload a CSV file</p>
              <p className="text-xs text-muted-foreground">Required column: first_name. Optional: last_name, company, email, phone, alternate_phone, source, industry, notes</p>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />

        {preview.length > 0 && !result && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-2 py-1.5 text-left">Name</th>
                  <th className="px-2 py-1.5 text-left">Company</th>
                  <th className="px-2 py-1.5 text-left">Email</th>
                  <th className="px-2 py-1.5 text-left">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((row, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">{row.firstName} {row.lastName}</td>
                    <td className="px-2 py-1.5">{row.companyName || "-"}</td>
                    <td className="px-2 py-1.5">{row.email || "-"}</td>
                    <td className="px-2 py-1.5">{row.phone || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > PREVIEW_LIMIT && (
              <p className="p-2 text-center text-[11px] text-muted-foreground">+{rows.length - PREVIEW_LIMIT} more rows</p>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p>Imported: {result.imported}</p>
            {result.failed > 0 && <p className="text-red-400">Failed: {result.failed}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button disabled={rows.length === 0 || importing} onClick={handleImport}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {rows.length > 0 ? rows.length : ""} Lead{rows.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
