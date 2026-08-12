import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const GROUPS = [
  {
    name: "2D National Education",
    meta: "Paying members · 27 members",
    img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=500&q=80",
  },
  {
    name: "Orleans Niagara Teacher Center",
    meta: "Private · 4 members",
    img: null,
  },
  {
    name: "Fixer Nation Positivity, Health & Wellness Network",
    meta: "Private · 23 members",
    img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&q=80",
  },
  {
    name: "Fixer Nation Vendors",
    meta: "Private · 6 members",
    img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80",
  },
  {
    name: "Brand Ambassador Group",
    meta: "Private · 6 members",
    img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&q=80",
  },
];

const POSTS = [
  {
    author: "Sample Member",
    group: "Fixer Nation PHW Network",
    time: "2h ago",
    body: "Started my Morning Boost habit this week — small win but it's already helping me stay focused.",
  },
  {
    author: "Sample Member",
    group: "2D National Education",
    time: "1d ago",
    body: "Used Lesson Plan 4-7 with my class today. Great discussion, the students really connected with it.",
  },
];

type Tab = "groups" | "posts";

const NetworkPage: NextPageWithLayout = () => {
  const [tab, setTab] = useState<Tab>("groups");

  return (
    <>
      <Head>
        <title>FN Network — Fixer Nation</title>
        <meta
          name="description"
          content="Connect with Fixer Nation groups and community members."
        />
      </Head>

      {/* Hero + tabs */}
      <section className="border-b border-[rgba(20,40,56,0.1)] px-6 pb-0 pt-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="eyebrow">FN Network</span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-navy">FN Network</h1>
          <p className="mt-2 text-base text-ink-soft">
            Connect with groups and members across Fixer Nation.
          </p>

          <div className="mt-8 flex gap-8">
            {(["groups", "posts"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "-mb-px border-b-[3px] pb-3 text-sm font-bold capitalize transition-colors",
                  tab === t
                    ? "border-amber text-navy"
                    : "border-transparent text-ink-soft hover:text-navy",
                ].join(" ")}
              >
                {t === "groups" ? "Groups" : "Posts"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">

          {tab === "groups" && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {GROUPS.map((g) => (
                <div
                  key={g.name}
                  className="overflow-hidden rounded-2xl bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]"
                >
                  <div className="aspect-video overflow-hidden bg-cream-panel">
                    {g.img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.img}
                        alt={g.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-extrabold text-navy">{g.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-ink-soft">{g.meta}</p>
                    <button className="mt-4 w-full rounded-[8px] border-2 border-navy py-2 text-xs font-bold text-navy transition-all hover:bg-navy hover:text-white">
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "posts" && (
            <div className="mx-auto max-w-2xl space-y-4">
              {POSTS.map((p, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white p-5 shadow-[0_12px_26px_-20px_rgba(20,40,56,0.22)]"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-9 w-9 flex-shrink-0 rounded-full bg-amber" />
                    <div>
                      <p className="text-sm font-bold text-ink">{p.author}</p>
                      <p className="text-xs text-ink-soft">
                        {p.group} · {p.time}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-ink">{p.body}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* CTA band */}
      <section className="bg-navy px-6 py-20 text-center lg:px-8">
        <div className="mx-auto max-w-xl">
          <span
            className="eyebrow"
            style={{ background: "rgba(255,255,255,0.12)", color: "#F2D9AE" }}
          >
            Membership
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white">
            Full network access comes with your membership
          </h2>
          <Link
            href="/join"
            className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
          >
            Join Fixer Nation
          </Link>
        </div>
      </section>
    </>
  );
};

NetworkPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default NetworkPage;
