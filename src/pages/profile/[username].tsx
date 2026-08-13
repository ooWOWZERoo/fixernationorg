import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type GroupItem = {
  id: string;
  name: string;
  slug: string;
  coverUrl: string | null;
  memberCount: number;
};

interface Props {
  profile: {
    userId: string;
    name: string | null;
    username: string;
    headline: string | null;
    bio: string | null;
    location: string | null;
    avatarUrl: string | null;
    joinedAt: string;
  };
  groups: GroupItem[];
  isOwnProfile: boolean;
  currentUserId: string | null;
}

const ProfilePage: NextPageWithLayout<Props> = ({
  profile,
  groups,
  isOwnProfile,
  currentUserId,
}) => {
  const [messageLoading, setMessageLoading] = useState(false);

  async function startMessage() {
    setMessageLoading(true);
    const res = await fetch("/api/network/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: profile.userId }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/network/messages/${data.conversationId}`;
    } else {
      setMessageLoading(false);
    }
  }

  const joinYear = new Date(profile.joinedAt).getFullYear();

  return (
    <>
      <Head>
        <title>{profile.name ?? profile.username} — Fixer Nation</title>
        <meta
          name="description"
          content={profile.headline ?? `${profile.name ?? profile.username}'s profile on Fixer Nation.`}
        />
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">

          {/* Profile header */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-5">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={profile.name ?? profile.username}
                  className="h-20 w-20 flex-shrink-0 rounded-full object-cover ring-2 ring-navy/10 sm:h-24 sm:w-24"
                />
              ) : (
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-navy text-2xl font-bold text-amber sm:h-24 sm:w-24">
                  {(profile.name ?? profile.username)[0].toUpperCase()}
                </div>
              )}

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                  {profile.name ?? profile.username}
                </h1>
                <p className="text-sm font-semibold text-ink-soft">@{profile.username}</p>
                {profile.headline && (
                  <p className="mt-1 text-sm text-ink">{profile.headline}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                  {profile.location && <span>📍 {profile.location}</span>}
                  <span>Member since {joinYear}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2 sm:mt-1">
              {isOwnProfile ? (
                <Link
                  href="/account/profile"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink no-underline hover:bg-cream-panel transition-colors"
                >
                  Edit profile
                </Link>
              ) : currentUserId ? (
                <button
                  onClick={startMessage}
                  disabled={messageLoading}
                  className="rounded-[10px] bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                >
                  {messageLoading ? "Opening…" : "Message"}
                </button>
              ) : (
                <Link
                  href="/signin"
                  className="rounded-[10px] bg-navy px-5 py-2 text-sm font-bold text-white no-underline hover:bg-navy-dark transition-colors"
                >
                  Sign in to message
                </Link>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-8 rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-ink-soft">
                About
              </h2>
              <p className="text-sm leading-relaxed text-ink whitespace-pre-line">{profile.bio}</p>
            </div>
          )}

          {/* Groups */}
          {groups.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-ink-soft">
                Groups
              </h2>
              <div className="flex flex-wrap gap-3">
                {groups.map((g) => (
                  <Link
                    key={g.id}
                    href={`/network/groups/${g.slug}`}
                    className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-navy no-underline shadow-[0_4px_12px_-8px_rgba(20,40,56,0.2)] hover:shadow-md transition-shadow"
                  >
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.coverUrl}
                        alt={g.name}
                        className="h-6 w-6 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-base">👥</span>
                    )}
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

ProfilePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const username = context.params?.username as string;
  const session = await getServerSession(context.req, context.res, authOptions);

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      createdAt: true,
      socialProfile: true,
      groupMemberships: {
        select: {
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              coverUrl: true,
              visibility: true,
              _count: { select: { members: true } },
            },
          },
        },
      },
    },
  });

  if (!user?.socialProfile) return { notFound: true };

  const groups: GroupItem[] = user.groupMemberships
    .filter((m) => m.group.visibility === "PUBLIC")
    .map((m) => ({
      id: m.group.id,
      name: m.group.name,
      slug: m.group.slug,
      coverUrl: m.group.coverUrl,
      memberCount: m.group._count.members,
    }));

  return {
    props: {
      profile: {
        userId: user.id,
        name: user.name,
        username: user.username!,
        headline: user.socialProfile.headline,
        bio: user.socialProfile.bio,
        location: user.socialProfile.location,
        avatarUrl: user.socialProfile.avatarUrl,
        joinedAt: user.createdAt.toISOString(),
      },
      groups,
      isOwnProfile: session?.user.id === user.id,
      currentUserId: session?.user.id ?? null,
    },
  };
};

export default ProfilePage;
