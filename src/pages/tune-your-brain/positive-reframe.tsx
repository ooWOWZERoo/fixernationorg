import type { NextPageWithLayout } from "@/types/next"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { SiteLayout } from "@/components/layout/SiteLayout"
import { AccountNav } from "@/components/account/AccountNav"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"
import { ScenarioGamePlayer } from "@/components/tuneBrain/ScenarioGamePlayer"
import { TimezoneCapture } from "@/components/tuneBrain/TimezoneCapture"

const GAME_KEY = "POSITIVE_REFRAME"

interface Props {
  hasTimezone: boolean
}

const PositiveReframePage: NextPageWithLayout<Props> = ({ hasTimezone }) => {
  const gameDef = TB_GAME_REGISTRY[GAME_KEY]

  return (
    <>
      <Head>
        <title>{gameDef.label} — Brain Builder — Fixer Nation</title>
      </Head>
      <TimezoneCapture hasTimezone={hasTimezone} />
      <section className="px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <Link href="/tune-your-brain" className="mb-4 inline-block text-sm font-semibold text-ink-soft hover:text-navy">
            ← Brain Builder
          </Link>

          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">{gameDef.emoji}</span>
            <h1 className="text-2xl font-extrabold text-navy">{gameDef.label}</h1>
          </div>
          <p className="text-sm text-ink-soft mb-6">{gameDef.shortDescription}</p>

          <ScenarioGamePlayer
            gameKey={GAME_KEY}
            correctLabel="That's a solid reframe."
            incorrectLabel="Here's another way to look at it:"
          />
        </div>
      </section>
    </>
  )
}

PositiveReframePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/tune-your-brain/positive-reframe", permanent: false } }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  return { props: { hasTimezone: !!user?.timezone } }
}

export default PositiveReframePage
