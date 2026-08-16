import Head from "next/head";
import Link from "next/link";
import { useState, useRef } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  initial: {
    username: string | null;
    headline: string | null;
    bio: string | null;
    location: string | null;
    avatarUrl: string | null;
  };
  role: string;
}

const EditProfilePage: NextPageWithLayout<Props> = ({ initial, role }) => {
  const isProvider = role === "PROVIDER";
  const [username, setUsername] = useState(initial.username ?? "");
  const [headline, setHeadline] = useState(initial.headline ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/network/upload", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      setAvatarUrl(data.url);
    } else {
      setError("Upload failed. Images must be under 5 MB.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, headline, bio, location, avatarUrl }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
    } else {
      setSuccess(true);
    }
    setSaving(false);
  }

  const initials = (username || "?")[0].toUpperCase();

  return (
    <>
      <Head>
        <title>Edit Profile — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/account" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              Settings
            </Link>
            <Link href="/account/security" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              Security
            </Link>
            {isProvider && (
              <Link href="/account/business" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
                Business profile
              </Link>
            )}
            {role === "AMBASSADOR" && (
              <Link href="/account/ambassador" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
                Ambassador profile
              </Link>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-navy">Your Profile</h1>
          <p className="mt-2 text-sm text-ink-soft">
            This is what other members see when they visit your profile.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-navy/10"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy text-2xl font-bold text-amber">
                  {initials}
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-panel disabled:opacity-50 transition-colors"
                >
                  {uploading ? "Uploading…" : "Change photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="ml-3 text-xs font-semibold text-ink-soft hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <p className="mt-1 text-xs text-ink-soft">JPG, PNG, GIF — up to 5 MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-bold text-navy" htmlFor="username">
                Username
              </label>
              <p className="mt-0.5 text-xs text-ink-soft">
                Your public handle — lowercase letters, numbers, underscores only.
              </p>
              <div className="relative mt-1.5">
                <span className="absolute inset-y-0 left-3 flex items-center text-sm text-ink-soft">@</span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="yourhandle"
                  maxLength={30}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-7 pr-4 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
            </div>

            {/* Headline */}
            <div>
              <label className="block text-sm font-bold text-navy" htmlFor="headline">
                Headline
              </label>
              <input
                id="headline"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Wellness coach & community builder"
                maxLength={120}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-bold text-navy" htmlFor="bio">
                About you
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Share a bit about yourself, your story, or what brings you to Fixer Nation."
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm leading-relaxed focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
              <p className="mt-1 text-right text-xs text-ink-soft">{bio.length}/1000</p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-bold text-navy" htmlFor="location">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Atlanta, GA"
                maxLength={80}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                Profile saved.
              </p>
            )}

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-[10px] bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(20,40,56,0.4)] hover:bg-navy-dark disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
              {initial.username && (
                <a
                  href={`/profile/${initial.username}`}
                  className="text-sm font-semibold text-ink-soft no-underline hover:text-navy transition-colors"
                >
                  View public profile →
                </a>
              )}
            </div>
          </form>
        </div>
      </section>
    </>
  );
};

EditProfilePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent("/account/profile")}`,
        permanent: false,
      },
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, socialProfile: true },
  });

  return {
    props: {
      initial: {
        username: user?.username ?? null,
        headline: user?.socialProfile?.headline ?? null,
        bio: user?.socialProfile?.bio ?? null,
        location: user?.socialProfile?.location ?? null,
        avatarUrl: user?.socialProfile?.avatarUrl ?? null,
      },
      role: session.user.role ?? "CONSUMER",
    },
  };
};

export default EditProfilePage;
