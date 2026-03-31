"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackItem, FeedbackPatchPayload } from "@/types/feedback";
import { FEEDBACK_STATUSES } from "@/types/feedback";

interface FeedbackDetailPanelProps {
  item: FeedbackItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (id: string, payload: FeedbackPatchPayload) => Promise<void>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function FeedbackDetailPanel({
  item,
  isSaving,
  onClose,
  onSave,
}: FeedbackDetailPanelProps) {
  const [status, setStatus] = useState<FeedbackItem["status"]>("new");
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) {
      return;
    }

    setStatus(item.status);
    setAdminNote(item.admin_note ?? "");
    setError(null);
  }, [item]);

  if (!item) {
    return null;
  }

  const handleSave = async () => {
    setError(null);

    try {
      await onSave(item.id, {
        status,
        admin_note: adminNote,
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save feedback changes.";
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65 p-3">
      <aside className="h-full w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-soft">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Feedback detail</h3>
            <p className="text-xs text-muted">Created: {formatDate(item.created_at)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 text-sm">
          <section className="space-y-1 rounded-lg border border-border bg-surfaceMuted/50 p-3">
            <p className="text-xs uppercase text-muted">Message</p>
            <p className="whitespace-pre-wrap text-foreground">{item.message}</p>
          </section>

          <section className="grid gap-3 rounded-lg border border-border bg-surfaceMuted/40 p-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-muted">User ID</p>
              <p className="break-all text-foreground">{item.user_id}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">User email</p>
              <p className="break-all text-foreground">{item.user_email ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">Source</p>
              <p className="text-foreground">{item.source}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">Page path</p>
              <p className="break-all text-foreground">{item.page_path ?? "-"}</p>
            </div>
          </section>

          <div className="space-y-1">
            <label className="text-xs uppercase text-muted">Status</label>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as FeedbackItem["status"])}
            >
              {FEEDBACK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase text-muted">Admin note</label>
            <Textarea
              value={adminNote}
              placeholder="Internal note for this feedback"
              onChange={(event) => setAdminNote(event.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
