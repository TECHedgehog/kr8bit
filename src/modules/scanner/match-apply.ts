import { MatchStatus, STEAM_PROVIDER_NAME } from '../../shared/enums.js';
import { libraryRepository } from '../library/library.repository.js';
import { providerMatchRepository } from '../metadata/provider-match.repository.js';
import type { MatchDecision } from './match-policy.js';

export async function applyMatchResult(
  gameId: string,
  decision: MatchDecision,
  now: Date,
): Promise<boolean> {
  if (!decision.result || decision.status === MatchStatus.REJECTED) {
    return false;
  }

  const isSteam = decision.result.providerName === STEAM_PROVIDER_NAME;

  if (isSteam) {
    await libraryRepository.update(gameId, {
      matchStatus: decision.status,
      matchScore: decision.score,
      matchedAt: now,
      steamAppId: Number(decision.result.remoteId),
      title: decision.result.title,
    });
  } else {
    await libraryRepository.update(gameId, {
      matchStatus: decision.status,
      matchScore: decision.score,
      matchedAt: now,
      title: decision.result.title,
    });
    await providerMatchRepository.upsert({
      gameId,
      providerName: decision.result.providerName,
      remoteId: decision.result.remoteId,
      matchScore: decision.score,
      isPrimary: true,
      matchedAt: now,
    });
  }

  return true;
}
