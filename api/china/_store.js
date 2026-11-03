import { redis } from "../_redis.js";
import { PARTICIPANTS } from "./_participants.js";

const contribKey = (id) => `china:contributions:${id}`;
const personKey = (id) => `china:participant:${id}`;

function parse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function loadContributions() {
  const entries = await Promise.all(
    PARTICIPANTS.map(async (p) => {
      const hash = await redis.hgetall(contribKey(p.id));
      return [p.id, Object.values(hash).map(parse).filter(Boolean)];
    })
  );
  return Object.fromEntries(entries);
}

export async function getContribution(participantId, id) {
  const hash = await redis.hgetall(contribKey(participantId));
  return hash[id] ? parse(hash[id]) : null;
}

export async function saveContribution(participantId, contribution) {
  await redis.hset(contribKey(participantId), { [contribution.id]: JSON.stringify(contribution) });
}

export async function removeContribution(participantId, id) {
  return (await redis.hdel(contribKey(participantId), id)) > 0;
}

export async function loadPerson(id) {
  return redis.hgetall(personKey(id));
}

export async function savePerson(id, fields) {
  await redis.hset(personKey(id), fields);
}

export async function clearPersonFields(id, ...fields) {
  await redis.hdel(personKey(id), ...fields);
}
