import { describe, expect, it } from 'vitest';
import {
  fromMinutes,
  generateSlotTimes,
  partitionSlots,
  rangesOverlap,
  selectFreeSlots,
  toMinutes,
} from '../slots';

describe('toMinutes / fromMinutes', () => {
  it('round-trips times', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(fromMinutes(570)).toBe('09:30');
    expect(toMinutes('8:05')).toBe(485);
    expect(fromMinutes(0)).toBe('00:00');
  });

  it('rejects invalid times', () => {
    expect(() => toMinutes('25:00')).toThrow();
    expect(() => toMinutes('09:75')).toThrow();
    expect(() => toMinutes('noon')).toThrow();
  });
});

describe('generateSlotTimes', () => {
  it('generates back-to-back slots that fit the duration', () => {
    const slots = generateSlotTimes('09:00', '12:00', 30);
    expect(slots).toHaveLength(6);
    expect(slots[0]).toEqual({ start: '09:00', end: '09:30' });
    expect(slots[5]).toEqual({ start: '11:30', end: '12:00' });
  });

  it('drops a trailing partial slot', () => {
    expect(generateSlotTimes('09:00', '09:50', 30)).toEqual([
      { start: '09:00', end: '09:30' },
    ]);
  });

  it('returns nothing when the window is too short or inverted', () => {
    expect(generateSlotTimes('09:00', '09:20', 30)).toEqual([]);
    expect(generateSlotTimes('17:00', '09:00', 30)).toEqual([]);
  });

  it('rejects a non-positive duration', () => {
    expect(() => generateSlotTimes('09:00', '12:00', 0)).toThrow();
    expect(() => generateSlotTimes('09:00', '12:00', -15)).toThrow();
  });
});

describe('busy slot filtering', () => {
  const candidates = generateSlotTimes('09:00', '12:00', 30);

  it('detects overlapping ranges but not adjacent ones', () => {
    expect(rangesOverlap(540, 570, 560, 590)).toBe(true);
    expect(rangesOverlap(540, 570, 570, 600)).toBe(false);
  });

  it('removes busy candidates and keeps the rest', () => {
    const free = selectFreeSlots(candidates, [
      { start: '09:30', end: '10:00' },
      { start: '11:00', end: '11:45' },
    ]);
    expect(free.map((slot) => slot.start)).toEqual(['09:00', '10:00', '10:30']);
  });

  it('returns every slot when nothing is busy', () => {
    expect(selectFreeSlots(candidates, [])).toHaveLength(candidates.length);
  });
});

describe('partitionSlots', () => {
  it('groups slots by clinic-local part of day', () => {
    const slots = [
      { slot_start: '2026-03-01T08:00:00.000Z' },
      { slot_start: '2026-03-01T11:59:00.000Z' },
      { slot_start: '2026-03-01T12:00:00.000Z' },
      { slot_start: '2026-03-01T16:59:00.000Z' },
      { slot_start: '2026-03-01T17:00:00.000Z' },
      { slot_start: '2026-03-01T20:30:00.000Z' },
    ];
    const grouped = partitionSlots(slots, 'UTC');
    expect(grouped.morning).toHaveLength(2);
    expect(grouped.afternoon).toHaveLength(2);
    expect(grouped.evening).toHaveLength(2);
  });

  it('uses the requested timezone', () => {
    const slots = [{ slot_start: '2026-03-01T06:30:00.000Z' }];
    expect(partitionSlots(slots, 'UTC').morning).toHaveLength(1);
    expect(partitionSlots(slots, 'Asia/Kolkata').afternoon).toHaveLength(1);
  });
});
