export const GOAL_CENTS = 1_130_000;

export const PARTICIPANTS = [
  { id: "p1", name: "Lincoli", pinEnv: "PIN_PARTICIPANTE_1" },
  { id: "p2", name: "Larice", pinEnv: "PIN_PARTICIPANTE_2" },
  { id: "p3", name: "Lucas", pinEnv: "PIN_PARTICIPANTE_3" },
  { id: "p4", name: "Adriana", pinEnv: "PIN_PARTICIPANTE_4" },
  { id: "p5", name: "Daniel", pinEnv: "PIN_PARTICIPANTE_5" },
].map((p) => ({ ...p, goalCents: GOAL_CENTS }));

export function findParticipant(id) {
  return PARTICIPANTS.find((p) => p.id === id) ?? null;
}
