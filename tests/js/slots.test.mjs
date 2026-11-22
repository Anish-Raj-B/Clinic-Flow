import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fromMinutes,
  generateSlotTimes,
  partitionSlots,
  rangesOverlap,
  selectFreeSlots,
  toMinutes,
} from "../../frontend/js/slots.js";

describe("toMinutes / fromMinutes", () => {
  it("round-trips times", () => {
    assert.equal(toMinutes("09:30"), 570);
    assert.equal(fromMinutes(570), "09:30");
    assert.equal(toMinutes("8:05"), 485);
    assert.equal(fromMinutes(0), "00:00");
  });

  it("rejects invalid times", () => {
    assert.throws(() => toMinutes("25:00"));
    assert.throws(() => toMinutes("09:75"));
    assert.throws(() => toMinutes("noon"));
  });
});

describe("generateSlotTimes", () => {
  it("generates back-to-back slots that fit the duration", () => {
    const slots = generateSlotTimes("09:00", "12:00", 30);
    assert.equal(slots.length, 6);
    assert.deepEqual(slots[0], { start: "09:00", end: "09:30" });
    assert.deepEqual(slots[5], { start: "11:30", end: "12:00" });
  });

  it("drops a trailing partial slot", () => {
    assert.deepEqual(generateSlotTimes("09:00", "09:50", 30), [
      { start: "09:00", end: "09:30" },
    ]);
  });

  it("returns nothing when the window is too short or inverted", () => {
    assert.deepEqual(generateSlotTimes("09:00", "09:20", 30), []);
    assert.deepEqual(generateSlotTimes("17:00", "09:00", 30), []);
  });

  it("rejects a non-positive duration", () => {
    assert.throws(() => generateSlotTimes("09:00", "12:00", 0));
    assert.throws(() => generateSlotTimes("09:00", "12:00", -15));
  });
});

describe("busy slot filtering", () => {
  const candidates = generateSlotTimes("09:00", "12:00", 30);

  it("detects overlapping ranges but not adjacent ones", () => {
    assert.equal(rangesOverlap(540, 570, 560, 590), true);
    assert.equal(rangesOverlap(540, 570, 570, 600), false);
  });

  it("removes busy candidates and keeps the rest", () => {
    const free = selectFreeSlots(candidates, [
      { start: "09:30", end: "10:00" },
      { start: "11:00", end: "11:45" },
    ]);
    assert.deepEqual(
      free.map((slot) => slot.start),
      ["09:00", "10:00", "10:30"],
    );
  });

  it("returns every slot when nothing is busy", () => {
    assert.equal(selectFreeSlots(candidates, []).length, candidates.length);
  });
});

describe("partitionSlots", () => {
  it("groups slots by clinic-local part of day", () => {
    const slots = [
      { slot_start: "2026-03-01T08:00:00.000Z" },
      { slot_start: "2026-03-01T11:59:00.000Z" },
      { slot_start: "2026-03-01T12:00:00.000Z" },
      { slot_start: "2026-03-01T16:59:00.000Z" },
      { slot_start: "2026-03-01T17:00:00.000Z" },
      { slot_start: "2026-03-01T20:30:00.000Z" },
    ];
    const grouped = partitionSlots(slots, "UTC");
    assert.equal(grouped.morning.length, 2);
    assert.equal(grouped.afternoon.length, 2);
    assert.equal(grouped.evening.length, 2);
  });

  it("uses the requested timezone", () => {
    const slots = [{ slot_start: "2026-03-01T06:30:00.000Z" }];
    assert.equal(partitionSlots(slots, "UTC").morning.length, 1);
    assert.equal(partitionSlots(slots, "Asia/Kolkata").afternoon.length, 1);
  });
});
