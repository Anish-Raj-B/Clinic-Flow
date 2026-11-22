/**
 * Pure slot-generation helpers.
 *
 * `generateSlotTimes` / `selectFreeSlots` mirror the SQL function
 * `get_available_slots` (see supabase/migrations). The database function remains
 * the authority for booking; these helpers group slots in the UI and are
 * covered by unit tests.
 */

export function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(time).trim());
  if (!match) throw new Error(`Invalid time: ${time}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time: ${time}`);
  return hours * 60 + minutes;
}

export function fromMinutes(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Generates back-to-back slots between start and end. A trailing partial slot
 * that does not fit the full service duration is dropped (same as SQL).
 */
export function generateSlotTimes(startTime, endTime, durationMinutes) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Duration must be a positive number of minutes");
  }
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (end <= start) return [];

  const slots = [];
  for (let cursor = start; cursor + durationMinutes <= end; cursor += durationMinutes) {
    slots.push({
      start: fromMinutes(cursor),
      end: fromMinutes(cursor + durationMinutes),
    });
  }
  return slots;
}

export function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

/** Returns candidates that do not overlap any busy range (minutes since 00:00). */
export function selectFreeSlots(candidates, busy) {
  return candidates.filter((candidate) => {
    const candidateStart = toMinutes(candidate.start);
    const candidateEnd = toMinutes(candidate.end);
    return !busy.some((block) => {
      const blockStart = toMinutes(block.start);
      const blockEnd = toMinutes(block.end);
      return rangesOverlap(candidateStart, candidateEnd, blockStart, blockEnd);
    });
  });
}

function hourInTimeZone(iso, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour");
  return Number(hour ? hour.value : "0");
}

/** Splits slots into morning (<12), afternoon (12-17) and evening (>=17). */
export function partitionSlots(slots, timeZone) {
  const partition = { morning: [], afternoon: [], evening: [] };
  for (const slot of slots) {
    const hour = hourInTimeZone(slot.slot_start, timeZone);
    if (hour < 12) partition.morning.push(slot);
    else if (hour < 17) partition.afternoon.push(slot);
    else partition.evening.push(slot);
  }
  return partition;
}
