const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const TIME_ZONE = "America/Sao_Paulo";
export const START = toIndex("2026-12");
export const END = toIndex("2027-08");
export const TOTAL_MONTHS = END - START + 1;
export const MILESTONES = [25, 50, 75, 100];
const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function toIndex(key) {
  const match = MONTH_KEY.exec(key);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function toKey(index) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(index) {
  return `${MONTH_NAMES[index % 12]} de ${Math.floor(index / 12)}`;
}

export function localDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  return { year, month, day: Number(parts.day), index: year * 12 + month - 1 };
}

export function percent(total, goal) {
  if (goal <= 0) return 0;
  return (total / goal) * 100;
}

export function monthsRemaining(current) {
  if (current < START) return TOTAL_MONTHS;
  if (current > END) return 0;
  return END - current + 1;
}

export function monthlyNeeded(remaining, monthsLeft) {
  if (remaining <= 0) return 0;
  if (monthsLeft <= 0) return remaining;
  return Math.ceil(remaining / monthsLeft);
}

export function idealThrough(index, goal) {
  if (index < START) return 0;
  const months = Math.min(index, END) - START + 1;
  return Math.round((goal * months) / TOTAL_MONTHS);
}

export function status(total, goal, current) {
  if (total > idealThrough(current, goal)) return "ahead";
  if (total < idealThrough(current - 1, goal)) return "behind";
  return "on-track";
}

export function monthsElapsed(current) {
  return Math.max(1, current - START + 1);
}

export function projection(total, goal, current) {
  if (total >= goal) return { reached: true, month: null, onTime: true };
  if (total <= 0) return { reached: false, month: null, onTime: false };

  const average = total / monthsElapsed(current);
  const month = START + Math.ceil(goal / average) - 1;
  return { reached: false, month: toKey(month), onTime: month <= END };
}

export function milestonesDue(total, goal) {
  return MILESTONES.filter((threshold) => total * 100 >= goal * threshold);
}

function sum(contributions) {
  return contributions.reduce((acc, c) => acc + c.amountCents, 0);
}

function cumulative(contributions, goal, current) {
  const byMonth = new Map();
  for (const c of contributions) {
    const index = toIndex(c.month);
    byMonth.set(index, (byMonth.get(index) ?? 0) + c.amountCents);
  }

  let running = 0;
  const points = [];
  for (let index = START; index <= END; index++) {
    running += byMonth.get(index) ?? 0;
    points.push({
      month: toKey(index),
      ideal: idealThrough(index, goal),
      real: index <= Math.max(current, START) ? running : null,
    });
  }
  return points;
}

export function stats(contributions, goal, current) {
  const total = sum(contributions);
  const remaining = Math.max(0, goal - total);
  const left = monthsRemaining(current);

  return {
    goal,
    total,
    percent: percent(total, goal),
    remaining,
    monthsRemaining: left,
    monthlyNeeded: monthlyNeeded(remaining, left),
    status: status(total, goal, current),
    projection: projection(total, goal, current),
    series: cumulative(contributions, goal, current),
  };
}

export function summarize(participants, contributionsById, now = new Date()) {
  const { index: current } = localDate(now);

  const people = participants.map((p) => {
    const contributions = contributionsById[p.id] ?? [];
    return { id: p.id, name: p.name, ...stats(contributions, p.goalCents, current) };
  });

  const all = participants.flatMap((p) => contributionsById[p.id] ?? []);
  const groupGoal = participants.reduce((acc, p) => acc + p.goalCents, 0);
  const group = stats(all, groupGoal, current);

  const history = participants
    .flatMap((p) => (contributionsById[p.id] ?? []).map((c) => ({ ...c, participantId: p.id })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    currentMonth: toKey(current),
    start: toKey(START),
    end: toKey(END),
    group: { ...group, completed: people.filter((p) => p.total >= p.goal).length },
    people,
    history,
  };
}
