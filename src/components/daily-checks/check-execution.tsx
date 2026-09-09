"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, StickyNote, Paperclip, Download } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { completeChecklistItemAction, submitChecklistInstanceAction, addChecklistEvidenceAction } from "@/app/actions/daily-checks";
import { fileDownloadHref } from "@/lib/files/display";

export interface ExecItem {
  id: string;
  text: string;
  isDone: boolean;
  note: string | null;
  link: string | null;
  fileId: string | null;
  fileName: string | null;
  requiresNote: boolean;
  requiresLink: boolean;
  requiresAttachment: boolean;
}

function ItemRow({ instanceId, item }: { instanceId: string; item: ExecItem }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(item.note ?? "");
  const [link, setLink] = useState(item.link ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const needsEvidence = item.requiresNote || item.requiresLink || item.requiresAttachment;

  const uploadEvidence = (file: File) =>
    start(async () => {
      const fd = new FormData();
      fd.set("instanceId", instanceId);
      fd.set("itemId", item.id);
      fd.set("file", file);
      const res = await addChecklistEvidenceAction(null, fd);
      if (res.ok) { toast({ kind: "success", title: "Evidence attached" }); router.refresh(); }
      else toast({ kind: "error", title: res.error });
    });

  const toggle = (done: boolean) =>
    start(async () => {
      const res = await completeChecklistItemAction(instanceId, item.id, done, note, link);
      if (res.ok) router.refresh();
      else toast({ kind: "error", title: res.error });
    });

  return (
    <li className="rounded-md border border-line p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => toggle(!item.isDone)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${item.isDone ? "border-success bg-success text-white" : "border-line-strong hover:border-accent"}`}
          aria-label={item.isDone ? "Mark incomplete" : "Mark complete"}
        >
          {item.isDone && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] ${item.isDone ? "text-ink-3 line-through" : "text-ink"}`}>{item.text}</div>
          {needsEvidence && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {item.requiresNote && (
                <div className="flex items-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5 text-ink-3" />
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Confirmation note (required)" className="h-8" />
                </div>
              )}
              {item.requiresLink && (
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-ink-3" />
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Evidence link" className="h-8" />
                </div>
              )}
              {(item.requiresAttachment || item.requiresLink) && (
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEvidence(f); }} />
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
                    <Paperclip className="h-3.5 w-3.5" /> {item.fileId ? "Replace file" : "Attach file"}
                  </Button>
                  {item.fileId && (
                    <a href={fileDownloadHref(item.fileId)} className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
                      <Download className="h-3.5 w-3.5" /> {item.fileName ?? "evidence"}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function CheckExecution({ instanceId, items }: { instanceId: string; items: ExecItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const done = items.filter((i) => i.isDone).length;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((i) => <ItemRow key={i.id} instanceId={instanceId} item={i} />)}
      </ul>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-3 tabular">{done}/{items.length} complete</span>
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await submitChecklistInstanceAction(instanceId);
              if (res.ok) {
                toast({ kind: "success", title: "Checks submitted" });
                router.refresh();
              } else toast({ kind: "error", title: res.error });
            })
          }
        >
          Submit completion
        </Button>
      </div>
    </div>
  );
}
