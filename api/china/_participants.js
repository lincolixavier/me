export const GOAL_CENTS = 1_130_000;

export const PARTICIPANTS = [
  { id: "p1", name: "Participante 1", pinEnv: "PIN_PARTICIPANTE_1" },
  { id: "p2", name: "Participante 2", pinEnv: "PIN_PARTICIPANTE_2" },
  { id: "p3", name: "Participante 3", pinEnv: "PIN_PARTICIPANTE_3" },
  { id: "p4", name: "Participante 4", pinEnv: "PIN_PARTICIPANTE_4" },
  { id: "p5", name: "Participante 5", pinEnv: "PIN_PARTICIPANTE_5" },
].map((p) => ({ ...p, goalCents: GOAL_CENTS }));

export function findParticipant(id) {
  return PARTICIPANTS.find((p) => p.id === id) ?? null;
}
