// Genera todos los slots de 30 minutos entre 07:00 y 18:00
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  let hour = 7;
  let minute = 0;

  while (hour < 18) {
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    minute += 30;
    if (minute >= 60) {
      minute = 0;
      hour++;
    }
  }

  return slots;
}

// Verifica si un slot está ocupado por alguna reserva
export function isSlotOccupied(
  slot: string,
  reservations: { startTime: string; endTime: string }[],
): boolean {
  const slotMin = timeToMinutes(slot);
  const slotEndMin = slotMin + 30;

  return reservations.some((r) => {
    const rStart = timeToMinutes(r.startTime);
    const rEnd = timeToMinutes(r.endTime);
    return slotMin < rEnd && slotEndMin > rStart;
  });
}

// Retorna la reserva que ocupa un slot (si existe)
export function getSlotReservation<T extends { startTime: string; endTime: string }>(
  slot: string,
  reservations: T[],
): T | undefined {
  const slotMin = timeToMinutes(slot);
  const slotEndMin = slotMin + 30;

  return reservations.find((r) => {
    const rStart = timeToMinutes(r.startTime);
    const rEnd = timeToMinutes(r.endTime);
    return slotMin < rEnd && slotEndMin > rStart && slotMin >= rStart;
  });
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isPastSlot(dateStr: string, slot: string): boolean {
  const now = new Date();
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = slot.split(':').map(Number);
  const slotDate = new Date(y, mo - 1, d, h, m);
  return slotDate <= now;
}

export function isWeekday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

// Genera los 7 días de la semana actual (lunes a domingo)
export function getWeekDays(referenceDate: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes
  const monday = new Date(d.setDate(diff));

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }

  return days;
}

export function formatDateToISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('es-HN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('es-HN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
