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
import { MissionGamePlayer } from "@/components/tuneBrain/MissionGamePlayer"
import { TimezoneCapture } from "@/components/tuneBrain/TimezoneCapture"

const GAME_KEY = "KINDNESS_QUEST"

interface Props {
  hasTimezone: boolean
  initialMission: { sessionId: string; prompt: string } | null
}

const KindnessQuestPage: NextPageWithLayout<Props> = ({ hasTimezone, initialMission }) => {
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

          <MissionGamePlayer gameKey={GAME_KEY} initialMission={initialMission} />
        </div>
      </section>
    </>
  )
}

KindnessQuestPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/signin?callbackUrl=/tune-your-brain/kindness-quest", permanent: false } }

  const userId = session.user.id
  const user = await db.user.findUnique({ where: { id: userId } })

  // Resume any mission the member already accepted but hasn't marked done
  // yet -- otherwise a simple page reload would look like it lost their
  // in-progress mission.
  const activeMission = await db.tbKindnessMission.findFirst({
    where: { userId, completedAt: null },
    orderBy: { acceptedAt: "desc" },
  })

  let initialMission: Props["initialMission"] = null
  if (activeMission) {
    const contentItem = await db.tbContentItem.findUnique({ where: { id: activeMission.contentItemId } })
    if (contentItem) {
      initialMission = { sessionId: activeMission.sessionId, prompt: contentItem.prompt }
    }
  }

  return { props: { hasTimezone: !!user?.timezone, initialMission } }
}

export default KindnessQuestPage
