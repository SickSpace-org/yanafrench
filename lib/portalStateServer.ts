// Server-only. Kept separate from lib/portalState.ts (which lib/usePortalState.ts,
// a client hook, also imports) so this file's dependency on lib/r2's AWS SDK
// client never ends up in the browser bundle.

import { readJson, writeJson } from "./r2";
import { normalizeBatch, storedBatch, type StoredBatch } from "./batchData";
import { defaultPortalState, PORTAL_STATE_KEY, type PortalState } from "./portalState";

// The stored R2 document was written before some of PortalState's current
// fields existed (e.g. batches, quizSessions) — reading it raw would hand
// a reducer case or route handler an `undefined` where it expects an
// array/object. Every server read merges defaults on top for that reason,
// and turns batches saved before multi-slot schedules into the current
// shape (lib/batchData.ts normalizeBatch).
export async function readPortalState(): Promise<PortalState> {
  const raw = { ...defaultPortalState, ...(await readJson<PortalState>(PORTAL_STATE_KEY, defaultPortalState)) };
  return { ...raw, batches: (raw.batches as StoredBatch[]).map(normalizeBatch) };
}

// Every write of the document goes through here, so each batch is stored
// with its slots plus the legacy single-timing fields mirrored from the
// first slot (lib/batchData.ts storedBatch) for older deployments.
export async function writePortalState(state: PortalState): Promise<boolean> {
  return writeJson(PORTAL_STATE_KEY, { ...state, batches: state.batches.map(storedBatch) });
}
