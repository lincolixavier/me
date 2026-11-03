import test from "node:test";
import assert from "node:assert/strict";

import {
  START,
  END,
  toIndex,
  toKey,
  localDate,
  percent,
  monthsRemaining,
  monthlyNeeded,
  idealThrough,
  status,
  projection,
  milestonesDue,
  summarize,
} from "../../api/china/_calc.js";

const GOAL = 1_130_000;
const at = (key) => toIndex(key);

test("the window is december 2026 through august 2027, nine months", () => {
  assert.equal(toKey(START), "2026-12");
  assert.equal(toKey(END), "2027-08");
  assert.equal(END - START + 1, 9);
});

test("month keys round-trip and reject garbage", () => {
  assert.equal(toKey(toIndex("2027-01")), "2027-01");
  assert.equal(toIndex("2027-13"), null);
  assert.equal(toIndex("2027-1"), null);
  assert.equal(toIndex("nope"), null);
});

test("local date follows Sao Paulo, not UTC", () => {
  const lateNightUtc = new Date("2027-01-01T02:00:00Z");
  assert.deepEqual(localDate(lateNightUtc), { year: 2026, month: 12, day: 31, index: at("2026-12") });
});

test("percent of the goal", () => {
  assert.equal(percent(0, GOAL), 0);
  assert.equal(percent(282_500, GOAL), 25);
  assert.equal(percent(GOAL, GOAL), 100);
  assert.equal(percent(GOAL * 2, GOAL), 200);
  assert.equal(percent(100, 0), 0);
});

test("months remaining counts the current month and stops at august 2027", () => {
  assert.equal(monthsRemaining(at("2026-11")), 9);
  assert.equal(monthsRemaining(at("2026-12")), 9);
  assert.equal(monthsRemaining(at("2027-01")), 8);
  assert.equal(monthsRemaining(at("2027-08")), 1);
  assert.equal(monthsRemaining(at("2027-09")), 0);
});

test("monthly needed splits what is left over the months left", () => {
  assert.equal(monthlyNeeded(GOAL, 9), 125_556);
  assert.equal(monthlyNeeded(900_00, 3), 300_00);
  assert.equal(monthlyNeeded(0, 5), 0);
  assert.equal(monthlyNeeded(-10, 5), 0);
  assert.equal(monthlyNeeded(500_00, 0), 500_00);
});

test("the ideal line grows one ninth of the goal per month", () => {
  assert.equal(idealThrough(at("2026-11"), 900), 0);
  assert.equal(idealThrough(at("2026-12"), 900), 100);
  assert.equal(idealThrough(at("2027-04"), 900), 500);
  assert.equal(idealThrough(at("2027-08"), 900), 900);
  assert.equal(idealThrough(at("2028-01"), 900), 900);
});

test("status compares the total with the ideal line", () => {
  const march = at("2027-03");
  assert.equal(status(300, 900, march), "on-track");
  assert.equal(status(400, 900, march), "on-track");
  assert.equal(status(401, 900, march), "ahead");
  assert.equal(status(299, 900, march), "behind");
  assert.equal(status(0, 900, at("2026-12")), "on-track");
  assert.equal(status(0, 900, at("2027-01")), "behind");
  assert.equal(status(50, 900, at("2026-11")), "ahead");
  assert.equal(status(900, 900, at("2027-08")), "on-track");
});

test("projection keeps the current monthly average", () => {
  assert.deepEqual(projection(0, 900, at("2027-01")), { reached: false, month: null, onTime: false });
  assert.deepEqual(projection(900, 900, at("2027-01")), { reached: true, month: null, onTime: true });
  assert.deepEqual(projection(200, 900, at("2027-01")), { reached: false, month: "2027-08", onTime: true });
  assert.deepEqual(projection(100, 900, at("2027-01")), { reached: false, month: "2028-05", onTime: false });
  assert.deepEqual(projection(300, 900, at("2026-12")), { reached: false, month: "2027-02", onTime: true });
});

test("milestones due are every threshold already crossed", () => {
  assert.deepEqual(milestonesDue(0, 1000), []);
  assert.deepEqual(milestonesDue(249, 1000), []);
  assert.deepEqual(milestonesDue(250, 1000), [25]);
  assert.deepEqual(milestonesDue(760, 1000), [25, 50, 75]);
  assert.deepEqual(milestonesDue(1000, 1000), [25, 50, 75, 100]);
});

test("summary adds people into the group and orders history newest first", () => {
  const participants = [
    { id: "a", name: "A", goalCents: 900 },
    { id: "b", name: "B", goalCents: 900 },
  ];
  const contributions = {
    a: [
      { id: "1", month: "2026-12", amountCents: 100, createdAt: "2026-12-05T12:00:00.000Z" },
      { id: "2", month: "2027-01", amountCents: 100, createdAt: "2027-01-05T12:00:00.000Z" },
    ],
    b: [{ id: "3", month: "2026-12", amountCents: 900, createdAt: "2026-12-20T12:00:00.000Z" }],
  };

  const s = summarize(participants, contributions, new Date("2027-01-15T15:00:00Z"));

  assert.equal(s.currentMonth, "2027-01");
  assert.equal(s.group.total, 1100);
  assert.equal(s.group.goal, 1800);
  assert.equal(s.group.remaining, 700);
  assert.equal(s.group.completed, 1);
  assert.equal(s.people[0].status, "on-track");
  assert.equal(s.people[0].monthlyNeeded, 88);
  assert.equal(s.people[1].projection.reached, true);
  assert.deepEqual(s.history.map((c) => c.id), ["2", "3", "1"]);

  const series = s.people[0].series;
  assert.equal(series.length, 9);
  assert.deepEqual(series[0], { month: "2026-12", ideal: 100, real: 100 });
  assert.deepEqual(series[1], { month: "2027-01", ideal: 200, real: 200 });
  assert.equal(series[2].real, null);
});
