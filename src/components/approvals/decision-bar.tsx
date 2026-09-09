"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, RotateCcw, Ban } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { decideApprovalAction, cancelApprovalAction } from "@/app/actions/approvals";

export function DecisionBar({ requestId, canDecide, canCancel }: { requestId: string; canDecide: boolean; canCancel: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();

  const decide = (decision: "approved" | "rejected" | "changes") =>
    start(async () => {
      const res = await decideApprovalAction(requestId, decision, comment.trim() || undefined);
      if (res.ok) {
        toast({ kind: "success", title: decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Changes requested" });
        setComment("");
        router.refresh();
      } else toast({ kind: "error", title: res.error });
    });

  const cancel = () =>
    start(async () => {
      const res = await cancelApprovalAction(requestId);
      if (res.ok) {
        toast({ kind: "success", title: "Request cancelled" });
        router.refresh();
      } else toast({ kind: "error", title: res.error });
    });

  if (!canDecide && !canCancel) return null;

  return (
    <div className="space-y-3">
      {canDecide && (
        <>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (optional)…" className="min-h-16" />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={pending} onClick={() => decide("approved")}><Check className="h-4 w-4" /> Approve</Button>
            <Button variant="secondary" disabled={pending} onClick={() => decide("changes")}><RotateCcw className="h-4 w-4" /> Request changes</Button>
            <Button variant="danger" disabled={pending} onClick={() => decide("rejected")}><X className="h-4 w-4" /> Reject</Button>
          </div>
        </>
      )}
      {canCancel && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={cancel}><Ban className="h-4 w-4" /> Cancel request</Button>
      )}
    </div>
  );
}
