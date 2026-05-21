"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/state";
import type { AffiliateCode, AffiliateCodesResponse, CreateAffiliateCodeBody } from "@/types/affiliate";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ endsAt }: { endsAt: string }) {
  const isExpired = new Date(endsAt) < new Date();
  if (isExpired) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-surfaceMuted/50 px-2 py-0.5 text-xs font-medium text-muted">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
      Active
    </span>
  );
}

const DEFAULT_FORM: CreateAffiliateCodeBody = {
  code: "",
  influencer_name: "",
  influencer_email: "",
  campaign_days: 30,
  payout_per_user_cents: 100,
};

export function AffiliateView() {
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateAffiliateCodeBody>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/affiliate-codes");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AffiliateCodesResponse;
      setCodes(data.affiliate_codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load affiliate codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCodes();
  }, [fetchCodes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch("/api/admin/affiliate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          influencer_email: form.influencer_email || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; affiliate_code?: AffiliateCode };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setSubmitSuccess(`Affiliate code "${form.code.toUpperCase()}" created successfully.`);
      setForm(DEFAULT_FORM);
      setFormOpen(false);
      await fetchCodes();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create affiliate code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Affiliates</h1>
          <p className="mt-1 text-xs text-muted">Manage influencer affiliate codes and track performance.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormOpen((v) => !v);
            setSubmitError(null);
            setSubmitSuccess(null);
          }}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surfaceMuted/60"
        >
          {formOpen ? "Cancel" : "Create affiliate code"}
        </button>
      </div>

      {submitSuccess && (
        <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {submitSuccess}
        </div>
      )}

      {formOpen && (
        <Card title="New affiliate code">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted">
                  Code <span className="text-danger">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. JOHN50"
                  className="w-full rounded-lg border border-border bg-surfaceMuted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-info/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted">
                  Influencer name <span className="text-danger">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.influencer_name}
                  onChange={(e) => setForm((f) => ({ ...f, influencer_name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-lg border border-border bg-surfaceMuted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-info/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted">
                  Influencer email
                </label>
                <input
                  type="email"
                  value={form.influencer_email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, influencer_email: e.target.value }))}
                  placeholder="optional"
                  className="w-full rounded-lg border border-border bg-surfaceMuted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-info/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted">
                  Campaign days
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.campaign_days ?? 30}
                  onChange={(e) => setForm((f) => ({ ...f, campaign_days: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surfaceMuted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-info/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted">
                  Payout per user (cents)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.payout_per_user_cents ?? 100}
                  onChange={(e) => setForm((f) => ({ ...f, payout_per_user_cents: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surfaceMuted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-info/50"
                />
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {submitError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg border border-info/40 bg-info/15 px-5 py-2 text-sm font-medium text-info transition-colors hover:bg-info/25 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create code"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <LoadingState message="Loading affiliate codes…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : codes.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-muted">No affiliate codes yet. Create one above.</p>
        </Card>
      ) : (
        <Card title="Affiliate codes" subtitle={`${codes.length} code${codes.length === 1 ? "" : "s"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Code", "Influencer", "Email", "Campaign ends", "Signups", "Conversions (paid)", "Payout/user", "Stripe coupon", "Status"].map((h) => (
                    <th key={h} className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-widest text-muted last:pr-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {codes.map((c) => (
                  <tr key={c.id} className="group">
                    <td className="py-3 pr-4 font-mono text-xs font-semibold text-foreground">
                      {c.code}
                    </td>
                    <td className="py-3 pr-4 text-foreground">{c.influencer_name}</td>
                    <td className="py-3 pr-4 text-muted">{c.influencer_email ?? "—"}</td>
                    <td className="py-3 pr-4 text-foreground">{formatDate(c.campaign_ends_at)}</td>
                    <td className="py-3 pr-4 text-foreground">{c.signup_count}</td>
                    <td className="py-3 pr-4 text-foreground">{c.conversion_count}</td>
                    <td className="py-3 pr-4 text-foreground">{formatCurrency(c.payout_per_user_cents)}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted">{c.stripe_coupon_id}</td>
                    <td className="py-3">
                      <StatusBadge endsAt={c.campaign_ends_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
