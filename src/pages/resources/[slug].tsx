import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ResourceFull {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  type: string | null;
  imageUrl: string | null;
  fileUrl: string | null;
  authorName: string;
  publishedAt: string;
}

interface Props {
  resource: ResourceFull;
}

const ResourcePage: NextPageWithLayout<Props> = ({ resource }) => {
  const date = new Date(resource.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Head>
        <title>{resource.title} — Resources</title>
        <meta name="description" content={resource.excerpt ?? `${resource.title} — Fixer Nation Resources`} />
      </Head>

      {/* Back nav */}
      <div className="px-6 pt-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/resources" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy no-underline hover:opacity-70">
            ← Resources
          </Link>
        </div>
      </div>

      {/* Header */}
      <section className="px-6 pt-8 pb-4 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {resource.type && (
            <span className="mb-3 inline-block text-xs font-extrabold uppercase tracking-wider text-amber-dark">
              {resource.type}
            </span>
          )}
          <h1 className="text-3xl font-extrabold leading-snug text-navy lg:text-4xl">
            {resource.title}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm font-semibold text-ink">{resource.authorName}</span>
            <span className="text-ink-soft">·</span>
            <span className="text-sm text-ink-soft">{date}</span>
          </div>
          {resource.fileUrl && (
            <div className="mt-6">
              <a
                href={resource.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
              >
                Download resource
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Cover image */}
      {resource.imageUrl && (
        <div className="px-6 py-6 lg:px-8">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl">
            <Image src={resource.imageUrl} alt={resource.title} width={800} height={450} className="h-auto w-full object-cover" />
          </div>
        </div>
      )}

      {/* Body */}
      <section className="px-6 pb-20 pt-4 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {resource.body.split("\n\n").map((paragraph, i) => (
            <p key={i} className="mb-5 text-base leading-relaxed text-ink">{paragraph}</p>
          ))}
          {resource.fileUrl && (
            <div className="mt-8 rounded-xl border border-amber/30 bg-amber/8 p-6 text-center">
              <p className="mb-3 text-sm font-semibold text-navy">Ready to use this resource?</p>
              <a
                href={resource.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
              >
                Download resource
              </a>
            </div>
          )}
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-navy px-6 py-20 text-center lg:px-8">
        <div className="mx-auto max-w-xl">
          <span className="eyebrow" style={{ background: "rgba(255,255,255,0.12)", color: "#F2D9AE" }}>
            Member Library
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white">Want to keep going?</h2>
          <p className="mt-4 text-base text-white/75">
            Members get the full library — every guide, worksheet, and downloadable tool.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-4">
            <Link
              href="/resources"
              className="inline-flex items-center justify-center rounded-[10px] bg-white px-8 py-3.5 text-sm font-bold text-navy no-underline transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Back to Resources
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

ResourcePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const slug = context.params?.slug as string;

  const resource = await db.resource.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, excerpt: true, body: true, type: true, imageUrl: true, fileUrl: true, authorName: true, publishedAt: true },
  });

  if (!resource || !resource.publishedAt) return { notFound: true };

  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !isMember(session.user.role)) {
    return {
      redirect: {
        destination: `/join?callbackUrl=${encodeURIComponent(`/resources/${slug}`)}`,
        permanent: false,
      },
    };
  }

  return { props: { resource: JSON.parse(JSON.stringify(resource)) } };
};

export default ResourcePage;
