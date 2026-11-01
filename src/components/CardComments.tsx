"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageSquare, MoreHorizontal, Pencil, Reply, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment, editComment, listComments, type CardComment } from "@/app/actions";
import { Avatar } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { displayName, type Member } from "@/lib/types";

/** Someone's avatar, or a blank circle for a comment whose author has left. */
function Face({ member, size = 20 }: { member: Member | null; size?: number }) {
  if (member) return <Avatar member={member} size={size} className="ring-0" />;
  return <span className="shrink-0 rounded-full bg-muted" style={{ width: size, height: size }} />;
}

/**
 * One line with a send button inside, growing with the text. Enter sends, Shift+Enter starts a new
 * line, Esc cancels an edit or a reply.
 */
function Composer({
  initial = "",
  placeholder,
  autoFocus,
  onSave,
  onCancel,
}: {
  initial?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSave: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const c = useT().comments;
  const [body, setBody] = useState(initial);
  const [pending, startTransition] = useTransition();
  const save = () => {
    if (!body.trim() || pending) return;
    startTransition(async () => {
      try {
        await onSave(body);
        setBody("");
      } catch {
        toast.error(c.failed);
      }
    });
  };
  return (
    <div className="flex min-w-0 flex-1 items-end rounded-lg border bg-background transition-colors focus-within:border-border-strong focus-within:ring-3 focus-within:ring-ring/15 hover:border-border-strong">
      <textarea
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        // Put the caret after any text it opens with (an edit, or an @mention when replying to a reply).
        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape" && onCancel) {
            e.stopPropagation();
            onCancel();
          }
        }}
        readOnly={pending}
        rows={1}
        maxLength={5000}
        placeholder={placeholder ?? c.placeholder}
        aria-label={placeholder ?? c.placeholder}
        className="field-sizing-content block max-h-60 min-h-9 w-full resize-none bg-transparent py-2 pl-3 text-sm leading-5 outline-none placeholder:text-muted-foreground"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending || !body.trim()}
        onClick={save}
        aria-label={c.save}
        title={`${c.save} (Enter)`}
        className="m-0.5 shrink-0 text-muted-foreground enabled:text-primary"
      >
        <SendHorizontal />
      </Button>
    </div>
  );
}

/** One comment: avatar, name and time with a "…" menu on the right, the text, then Reply. */
function CommentItem({
  comment,
  author,
  replyCount,
  onReply,
  onChange,
}: {
  comment: CardComment;
  author: Member | null;
  /** Replies under it, to warn that deleting takes them too. */
  replyCount: number;
  onReply: () => void;
  onChange: () => void;
}) {
  const t = useT();
  const c = t.comments;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <div className="group/comment">
      <div className="flex items-center gap-2">
        <Face member={author} />
        <span className="truncate text-[13px] font-semibold">{author ? displayName(author) : c.unknown}</span>
        <span className="shrink-0 text-xs text-muted-foreground" title={t.fmt.ago(comment.createdAt)}>
          {t.fmt.stamp(comment.createdAt)}
          {comment.editedAt && <span title={t.fmt.stamp(comment.editedAt)}> · {c.edited}</span>}
        </span>
        {(comment.mine || comment.canDelete) && (
          <DropdownMenu onOpenChange={(open) => !open && setConfirming(false)}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="ml-auto text-muted-foreground" aria-label={c.actions}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {comment.mine && (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil /> {c.edit}
                </DropdownMenuItem>
              )}
              {comment.canDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    if (!confirming) {
                      e.preventDefault();
                      setConfirming(true);
                      return;
                    }
                    startTransition(async () => {
                      await deleteComment(comment.id);
                      onChange();
                    });
                  }}
                >
                  <Trash2 /> {confirming ? (replyCount ? c.confirmDeleteThread : c.confirmDelete) : c.delete}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="pl-7">
        {editing ? (
          <div className="mt-1.5 flex">
            <Composer
              autoFocus
              initial={comment.body}
              onSave={async (body) => {
                await editComment(comment.id, body);
                setEditing(false);
                onChange();
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="mt-1 text-sm leading-relaxed break-words [&_ol]:my-1 [&_p]:my-0 [&_p+p]:mt-1.5 [&_ul]:my-1">
            <Markdown text={comment.body} />
          </div>
        )}
        {!editing && (
          <button
            type="button"
            onClick={onReply}
            className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Reply className="size-3.5" /> {c.reply}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Comments under a card's description: a line to write one, then threads newest first. Each thread is a
 * comment with its replies under it, oldest first, indented on a line.
 */
export function CardComments({ cardId, members }: { cardId: string; members: Member[] }) {
  const c = useT().comments;
  const [data, setData] = useState<{ me: string; comments: CardComment[] } | null>(null);
  // Which thread has its reply box open, and what the box starts with.
  const [replying, setReplying] = useState<{ threadId: string; mention: string } | null>(null);
  const reload = () => listComments(cardId).then(setData, () => toast.error(c.failed));
  useEffect(() => {
    let live = true;
    listComments(cardId).then(
      (d) => live && setData(d),
      () => live && setData({ me: "", comments: [] }),
    );
    return () => {
      live = false;
    };
  }, [cardId]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const author = (comment: CardComment) => (comment.authorId ? (memberById.get(comment.authorId) ?? null) : null);
  const comments = data?.comments ?? [];
  const threads = comments.filter((x) => !x.parentId).reverse();
  const repliesOf = (threadId: string) => comments.filter((x) => x.parentId === threadId);
  // Replying to a reply from someone else starts with their name, so it's clear who's being answered.
  const reply = (threadId: string, to: CardComment) => {
    const who = author(to);
    setReplying({ threadId, mention: to.parentId && who && to.authorId !== data?.me ? `@${displayName(who)} ` : "" });
  };

  return (
    <section className="mt-6 border-t pt-5" aria-label={c.title}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="size-4 text-muted-foreground" />
        {c.title}
        {comments.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">{comments.length}</span>}
      </h3>

      <div className="mt-3 flex">
        <Composer
          onSave={async (body) => {
            await addComment(cardId, body);
            await reload();
          }}
        />
      </div>

      {data && threads.length === 0 && <p className="mt-3 text-xs text-muted-foreground">{c.empty}</p>}

      <ul className="mt-4 divide-y">
        {threads.map((thread) => {
          const replies = repliesOf(thread.id);
          const open = replying?.threadId === thread.id;
          return (
            <li key={thread.id} className="py-3 first:pt-0">
              <CommentItem comment={thread} author={author(thread)} replyCount={replies.length} onReply={() => reply(thread.id, thread)} onChange={reload} />
              {(replies.length > 0 || open) && (
                // Replies hang off a line under the comment's avatar.
                <div className="mt-3 ml-[9px] space-y-3 border-l-2 pl-[17px]">
                  {replies.map((r) => (
                    <CommentItem key={r.id} comment={r} author={author(r)} replyCount={0} onReply={() => reply(thread.id, r)} onChange={reload} />
                  ))}
                  {open && (
                    <div className="flex">
                      <Composer
                        // A new key restarts the box with the new mention when another reply is answered.
                        key={replying.mention}
                        autoFocus
                        initial={replying.mention}
                        placeholder={c.replyPlaceholder}
                        onSave={async (body) => {
                          await addComment(cardId, body, thread.id);
                          setReplying(null);
                          await reload();
                        }}
                        onCancel={() => setReplying(null)}
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
