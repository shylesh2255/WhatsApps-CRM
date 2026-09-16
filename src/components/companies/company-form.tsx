"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isValidEmail, isValidGstNumber, isValidPhone, isValidUrl } from "@/lib/validation/format";

interface CompanyFormProps {
  accountId: string;
  company?: {
    id: string;
    name: string;
    industry?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
    gst_number?: string | null;
    address?: string | null;
    notes?: string | null;
  };
  onSuccess: () => void;
}

export function CompanyForm({ accountId, company, onSuccess }: CompanyFormProps) {
  const { profile } = useAuth();
  const supabase = createClient();
  const isEdit = !!company;

  const [name, setName] = useState(company?.name || "");
  const [industry, setIndustry] = useState(company?.industry || "");
  const [website, setWebsite] = useState(company?.website || "");
  const [email, setEmail] = useState(company?.email || "");
  const [phone, setPhone] = useState(company?.phone || "");
  const [gstNumber, setGstNumber] = useState(company?.gst_number || "");
  const [address, setAddress] = useState(company?.address || "");
  const [notes, setNotes] = useState(company?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (website.trim() && !isValidUrl(website)) {
      toast.error("Enter a valid website URL");
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (gstNumber.trim() && !isValidGstNumber(gstNumber)) {
      toast.error("Enter a valid GST number (e.g., 22AAAAA0000A1Z5)");
      return;
    }

    if (!profile) return;

    setIsSubmitting(true);

    try {
      const companyData = {
        account_id: accountId,
        name: name.trim(),
        industry: industry.trim() || null,
        website: website.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        gst_number: gstNumber.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        updated_by: profile.id,
      };

      if (isEdit && company) {
        const { error } = await supabase
          .from("companies")
          .update(companyData)
          .eq("id", company.id);

        if (error) throw error;
        toast.success("Company updated successfully");
      } else {
        const { error } = await supabase.from("companies").insert([
          {
            ...companyData,
            created_by: profile.id,
          },
        ]);

        if (error) throw error;
        toast.success("Company added successfully");
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error("Failed to save company");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Company Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Acme Corp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            placeholder="e.g., Retail"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            placeholder="https://example.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="hello@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="gst_number">GST Number</Label>
        <Input
          id="gst_number"
          placeholder="e.g., 22AAAAA0000A1Z5"
          value={gstNumber}
          onChange={(e) => setGstNumber(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          placeholder="Company address..."
          className="resize-none"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Internal notes..."
          className="resize-none"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? "Saving..." : isEdit ? "Update Company" : "Add Company"}
      </Button>
    </form>
  );
}
