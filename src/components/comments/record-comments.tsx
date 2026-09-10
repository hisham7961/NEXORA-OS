"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageSquare, Trash2, Pencil, CornerDownRight } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { addCommentAction, editCommentAction, deleteCommentAction } from "@/app/actions/comments";

type Comment = { id: string; body: string; authorId: string; authorName: string; parentId: string | null; editedAt: string | null; createdAt: string };

/** Reusable per-record comment thread (§Phase4-23). Comment / reply / @mention / edit / delete. */
export function RecordComments({ entityType, entityId, currentUserId }: { entityType: string; entityId: string; currentUserId: string }) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pending, start] = useTransition();

  const load = () => fetch(`/api/v1/comments?entityType=${entityType}&entityId=${entityId}`).then((r) => r.json()).then((j) => setComments(j.data ?? [])).catch(() => setComments([]));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const post = () => start(async () => {
    if (!body.trim()) return;
    const r = await addCommentAction({ entityType, entityId, body, parentId: replyTo ?? undefined });
    if (r.ok) { setBody(""); setReplyTo(null); load(); } else toast({ kind: "error", title: r.error });
  });
  const saveEdit = (id: string) => start(async () => {
    const r = await editCommentAction(id, editBody);
    if (r.ok) { setEditing(null); load(); } else toast({ kind: "error", title: r.error });
  });
  const remove = (id: string) => start(async () => { const r = await deleteCommentAction(id); if (r.ok) load(); else toast({ kind: "error", title: r.error }); });

  const roots = (comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parentId === id);

  const CommentRow = ({ c, reply }: { c: Comment; reply?: boolean }) => (
    <div className={`py-2 ${reply ? "ms-6 border-s border-line ps-3" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="font-medium text-ink">{c.authorName}</span>
        <span className="text-ink-3">{new Date(c.createdAt).toLocaleString()}{c.editedAt ? " · edited" : ""}</span>
      </div>
      {editing === c.id ? (
        <div className="mt-1 space-y-1">
          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} />
          <div className="flex gap-2"><Button variant="primary" size="sm" disabled={pending} onClick={() => saveEdit(c.id)}>Save</Button><Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button></div>
        </div>
      ) : (
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-ink-2">{c.body}</p>
      )}
      {editing !== c.id && (
        <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-3">
          {!reply && <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => { setReplyTo(c.id); }}><CornerDownRight className="h-3 w-3" /> Reply</button>}
          {c.authorId === currentUserId && <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => { setEditing(c.id); setEditBody(c.body); }}><Pencil className="h-3 w-3" /> Edit</button>}
          {c.authorId === currentUserId && <button className="inline-flex items-center gap-1 hover:text-critical" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /> Delete</button>}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-ink"><MessageSquare className="h-4 w-4 text-ink-3" /> Comments {comments ? `(${comments.length})` : ""}</div>
      <div className="divide-y divide-line">
        {comments === null ? <p className="py-2 text-[13px] text-ink-3">Loading…</p>
          : roots.length === 0 ? <p className="py-2 text-[13px] text-ink-3">No comments yet. Use @name to mention a colleague.</p>
          : roots.map((c) => <div key={c.id}>{<CommentRow c={c} />}{repliesOf(c.id).map((r) => <CommentRow key={r.id} c={r} reply />)}</div>)}
      </div>
      <div className="mt-3 space-y-2">
        {replyTo && <div className="text-[11px] text-ink-3">Replying… <button className="text-accent hover:underline" onClick={() => setReplyTo(null)}>cancel</button></div>}
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a comment… (@name to mention)" />
        <div className="flex justify-end"><Button variant="primary" size="sm" disabled={pending || !body.trim()} onClick={post}>Comment</Button></div>
      </div>
    </div>
  );
}
