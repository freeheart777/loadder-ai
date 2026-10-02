// Upcoming = still pending/confirmed and not yet started; everything else is
// history, newest first. Statuses are shown exactly as stored, never inferred.
export function splitAppointmentTimeline(all, nowMs = Date.now()) {
  const upcoming = all.filter((item) => Date.parse(item.startsAt) >= nowMs && ["PENDING", "CONFIRMED"].includes(item.status));
  const past = all.filter((item) => !upcoming.includes(item)).reverse();
  return { upcoming, past };
}
