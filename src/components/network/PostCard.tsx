import { useState } from "react";
import Link from "next/link";

export type Attachment = { type: "image"; url: string; name: string };

export type PostData = {
  id: string;
  body: string;
  attachments: Attachment[] | null;
  pinned: boolean;
  createdAt: string;
  likedByMe: boolean;
  author: { id: string; name: string | null; image: string | null };
  group?: { id: string; name: string; slug: string };
  _count: { comments: number; reactions: number };
};

interface Props {
  post: PostData;
  currentUserId?: string;
  showGroup?: boolean;
  onDeleted?: (id: string) => void;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name ?? "User"} className="h-9 w-9 rounded-full object-cover" />;
  }
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber text-xs font-extrabold text-navy">
      {initials}
    </div>
  );
}

export function PostCard({ post, currentUserId, showGroup = false, onDeleted }: Props) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentCount, setCommentCount] = useState(post._count.comments);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = currentUserId && (currentUserId === post.author.id);

  async function toggleLike() {
    if (!currentUserId) return;
    const res = await fetch(`/api/network/posts/${post.id}/react`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.count);
    }
  }

  async function loadComments() {
    if (loadingComments) return;
    setLoadingComments(true);
    const res = await fetch(`/api/network/posts/${post.id}/comments`);
    if (res.ok) setComments(await res.json());
    setLoadingComments(false);
    setShowComments(true);
  }

  function toggleComments() {
    if (!showComments) loadComments();
    else setShowComments(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() || submittingComment) return;
    setSubmittingComment(true);
    const res = await fetch(`/api/network/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    });
    if (res.ok) {
      const c = await res.json();
      setComments((prev) => [...prev, c]);
      setCommentCount((n) => n + 1);
      setCommentBody("");
    }
    setSubmittingComment(false);
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return;
    setDeleting(true);
    const res = await fetch(`/api/network/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(post.id);
    else setDeleting(false);
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_12px_26px_-20px_rgba(20,40,56,0.18)]">
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <Avatar name={post.author.name} image={post.author.image} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{post.author.name ?? "Unknown"}</p>
          <p className="text-xs text-ink-soft">
            {showGroup && post.group && (
              <>
                <Link href={`/network/groups/${post.group.slug}`} className="no-underline hover:underline">
                  {post.group.name}
                </Link>
                {" · "}
              </>
            )}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={deletePost}
            disabled={deleting}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            title="Delete post"
          >
            ✕
          </button>
        )}
      </div>

      {/* Body */}
      <p className="text-sm leading-relaxed text-ink whitespace-pre-line">{post.body}</p>

      {/* Attachments */}
      {post.attachments && post.attachments.length > 0 && (
        <div className={`mt-3 grid gap-2 ${post.attachments.length === 1 ? "" : "grid-cols-2"}`}>
          {post.attachments.map((a, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={a.url}
              alt={a.name}
              className="w-full rounded-lg object-cover max-h-64"
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3">
        <button
          onClick={toggleLike}
          disabled={!currentUserId}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
            liked ? "text-amber-dark" : "text-ink-soft hover:text-amber-dark"
          } disabled:cursor-default`}
        >
          <span>{liked ? "♥" : "♡"}</span>
          <span>{likeCount > 0 ? likeCount : ""} Like{likeCount !== 1 ? "s" : ""}</span>
        </button>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-navy transition-colors"
        >
          <span>💬</span>
          <span>{commentCount > 0 ? commentCount : ""} Comment{commentCount !== 1 ? "s" : ""}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          {loadingComments && <p className="text-xs text-ink-soft">Loading…</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar name={c.author.name} image={c.author.image} />
              <div className="min-w-0 flex-1 rounded-xl bg-cream-panel px-3 py-2">
                <p className="text-xs font-bold text-ink">{c.author.name ?? "Unknown"}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink">{c.body}</p>
              </div>
            </div>
          ))}

          {currentUserId && (
            <form onSubmit={submitComment} className="flex gap-2 pt-1">
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment…"
                className="min-w-0 flex-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentBody.trim()}
                className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-40 transition-colors"
              >
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
