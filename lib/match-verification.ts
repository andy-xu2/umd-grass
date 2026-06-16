import { db } from '@/lib/db'
import { matches } from '@/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/utils'
import { applyConfirmedMatchIncrementalTx } from '@/lib/apply-confirmed-match'
import { recalculateSeasonRrFromTx } from '@/lib/recalculate-rr'
import { isMostRecentConfirmedMatchRow } from '@/lib/is-most-recent-match'

export type VerificationAction = 'confirm' | 'reject'

export type VerifyMatchResult = {
  ok: true
  seasonId: string
  recomputed?: boolean
}

export class MatchVerificationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'MatchVerificationError'
  }
}

export async function verifyMatch(
  matchId: string,
  userId: string,
  action: VerificationAction,
): Promise<VerifyMatchResult> {
  return db.transaction(async tx => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId))

    if (!match) {
      throw new MatchVerificationError(404, 'Match not found')
    }

    const admin = isAdmin(userId)
    if (
      !admin &&
      match.team2Player1Id !== userId &&
      match.team2Player2Id !== userId
    ) {
      throw new MatchVerificationError(403, 'Only the opposing team can verify this match')
    }

    if (match.status !== 'PENDING') {
      throw new MatchVerificationError(400, 'Match is not pending')
    }

    if (action === 'reject') {
      const [rejected] = await tx
        .update(matches)
        .set({ status: 'REJECTED' })
        .where(and(eq(matches.id, matchId), eq(matches.status, 'PENDING')))
        .returning({ seasonId: matches.seasonId })

      if (!rejected) {
        throw new MatchVerificationError(409, 'Match was already processed')
      }

      return { ok: true, seasonId: rejected.seasonId }
    }

    const verifiedAt = new Date()
    const [claimed] = await tx
      .update(matches)
      .set({
        status: 'CONFIRMED',
        verifiedBy: userId,
        verifiedAt,
      })
      .where(and(eq(matches.id, matchId), eq(matches.status, 'PENDING')))
      .returning()

    if (!claimed) {
      throw new MatchVerificationError(409, 'Match was already processed')
    }

    const isNewest = await isMostRecentConfirmedMatchRow(tx, claimed)

    if (isNewest) {
      await applyConfirmedMatchIncrementalTx(tx, claimed.id)
    } else {
      await recalculateSeasonRrFromTx(tx, claimed.seasonId, claimed)
    }

    return {
      ok: true,
      seasonId: claimed.seasonId,
      recomputed: !isNewest,
    }
  })
}
