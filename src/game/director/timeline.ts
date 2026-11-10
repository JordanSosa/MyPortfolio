/**
 * Director timeline types. The data moved into the stages: every stage file in
 * src/game/stages/ carries its own `phases` + `events` (see
 * stages/dream-meadow.ts for the reference timeline and the field docs).
 *
 * The Dream Meadow exports below stay for tools that probe the original stage
 * (tools/balance.probe.ts); new code reads `world.stage` instead.
 */
import { stagePhaseAt, type SpawnPhase, type TimelineEvent } from "../stage";
import { EVENTS, PHASES, dreamMeadow } from "../stages/dream-meadow";

export type { SpawnPhase, TimelineEvent };
export { EVENTS, PHASES };

/** Dream Meadow phase for run time t (stage-aware code: `stagePhaseAt(world.stage, t)`). */
export function phaseAt(t: number): SpawnPhase {
  return stagePhaseAt(dreamMeadow, t);
}
