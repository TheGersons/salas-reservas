import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto, GetReservationsQueryDto } from './dto/reservation.dto';
import {
  CreateBulkReservationDto,
  PreviewBulkReservationDto,
  Weekday,
} from './dto/bulk-reservation.dto';
import { ReservationStatus, SeriesStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { RRule, Frequency, Weekday as RRuleWeekday } from 'rrule';

export type BulkDateStatus = 'OK' | 'CONFLICT' | 'WEEKEND' | 'OUT_OF_HOURS' | 'PAST';

export interface BulkPreviewDate {
  date: string; // YYYY-MM-DD
  status: BulkDateStatus;
  conflictWith?: { id: number; startTime: string; endTime: string; requesterName: string };
  reason?: string;
}

export interface BulkPreviewResult {
  rrule: string;
  startTime: string;
  endTime: string;
  totalDates: number;
  summary: { ok: number; conflicts: number; weekend: number; outOfHours: number; past: number };
  dates: BulkPreviewDate[];
}

const SCHEDULE_START = '07:00';
const SCHEDULE_END = '18:00';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isWeekday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDay(); // 0=Dom, 6=Sab
  return day >= 1 && day <= 5;
}

function isPastDateTime(dateStr: string, startTime: string): boolean {
  const now = new Date();
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = startTime.split(':').map(Number);
  const reservationDate = new Date(y, mo - 1, d, h, m);
  return reservationDate <= now;
}

// rrule emite ocurrencias a medianoche UTC; extraer los componentes UTC
// evita que el offset local desplace la fecha al día anterior.
function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEKDAY_TO_RRULE: Record<Weekday, RRuleWeekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ─── Validaciones de horario ─────────────────────────
  private validateSchedule(startTime: string, endTime: string) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const scheduleStart = timeToMinutes(SCHEDULE_START);
    const scheduleEnd = timeToMinutes(SCHEDULE_END);

    if (start < scheduleStart || end > scheduleEnd) {
      throw new BadRequestException(
        `Las reservas solo se permiten entre ${SCHEDULE_START} y ${SCHEDULE_END}`,
      );
    }

    if (start >= end) {
      throw new BadRequestException('La hora de inicio debe ser antes de la hora de fin');
    }

    const diff = end - start;
    if (diff < 30) {
      throw new BadRequestException('La duración mínima es de 30 minutos');
    }
  }

  // ─── Buscar solapamiento (sin lanzar) ────────────────
  private async findOverlap(
    roomId: number,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: number,
  ) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        roomId,
        date: new Date(date + 'T00:00:00.000Z'),
        status: { not: ReservationStatus.CANCELLED },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    for (const r of reservations) {
      const existStart = timeToMinutes(r.startTime);
      const existEnd = timeToMinutes(r.endTime);
      if (newStart < existEnd && newEnd > existStart) {
        return r;
      }
    }
    return null;
  }

  // ─── Verificar solapamiento (lanza ConflictException) ─
  private async checkOverlap(
    roomId: number,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: number,
  ) {
    const conflict = await this.findOverlap(roomId, date, startTime, endTime, excludeId);
    if (conflict) {
      throw new ConflictException(
        `La sala ya tiene una reserva de ${conflict.startTime} a ${conflict.endTime} en esa fecha`,
      );
    }
  }

  // ─── Crear reservación (público) ────────────────────
  async create(dto: CreateReservationDto) {
    // 1. Validar que sea día de semana
    if (!isWeekday(dto.date)) {
      throw new BadRequestException('Solo se pueden hacer reservas de lunes a viernes');
    }

    // 2. Validar que no sea en el pasado
    if (isPastDateTime(dto.date, dto.startTime)) {
      throw new BadRequestException('No se puede reservar en una fecha/hora pasada');
    }

    // 3. Validar horario
    this.validateSchedule(dto.startTime, dto.endTime);

    // 4. Verificar sala existe
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException('La sala no existe');

    // 4b. Verificar mínimo de personas
    if (room.minAttendees && dto.attendees < room.minAttendees) {
      throw new BadRequestException(
        `${room.name} requiere un mínimo de ${room.minAttendees} personas para ser reservada`,
      );
    }

    // 5. Verificar solapamiento
    await this.checkOverlap(dto.roomId, dto.date, dto.startTime, dto.endTime);

    // 6. Crear
    const reservation = await this.prisma.reservation.create({
      data: {
        roomId: dto.roomId,
        date: new Date(dto.date + 'T00:00:00.000Z'),
        startTime: dto.startTime,
        endTime: dto.endTime,
        requesterName: dto.requesterName,
        email: dto.email,
        phone: dto.phone,
        attendees: dto.attendees,
        topic: dto.topic,
        status: ReservationStatus.PENDING,
      },
      include: { room: true },
    });

    // 7. Enviar correo de confirmación de recepción
    await this.notifications.sendReservationReceived(reservation);

    return reservation;
  }

  // ─── Consulta pública (para el calendario) ──────────
  async findPublic(query: GetReservationsQueryDto) {
    const where: any = {
      status: { not: ReservationStatus.CANCELLED },
    };

    if (query.roomId) where.roomId = Number(query.roomId);

    if (query.date) {
      where.date = new Date(query.date + 'T00:00:00.000Z');
    } else if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom + 'T00:00:00.000Z');
      if (query.dateTo) where.date.lte = new Date(query.dateTo + 'T00:00:00.000Z');
    }

    return this.prisma.reservation.findMany({
      where,
      select: {
        id: true,
        roomId: true,
        date: true,
        startTime: true,
        endTime: true,
        requesterName: true,
        status: true,
        room: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ─── Consulta admin (datos completos) ───────────────
  async findAll(query: GetReservationsQueryDto) {
    const where: any = {};

    if (query.roomId) where.roomId = Number(query.roomId);

    if (query.date) {
      where.date = new Date(query.date + 'T00:00:00.000Z');
    } else if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom + 'T00:00:00.000Z');
      if (query.dateTo) where.date.lte = new Date(query.dateTo + 'T00:00:00.000Z');
    }

    return this.prisma.reservation.findMany({
      where,
      include: {
        room: true,
        remindersSent: { orderBy: { sentAt: 'desc' } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ─── Actualizar estado (admin) ───────────────────────
  async updateStatus(id: number, status: ReservationStatus) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!reservation) throw new NotFoundException('Reservación no encontrada');

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: { status },
      include: { room: true },
    });

    // Enviar correo según el nuevo estado
    if (status === ReservationStatus.CONFIRMED) {
      await this.notifications.sendConfirmation(updated);
    } else if (status === ReservationStatus.CANCELLED) {
      await this.notifications.sendCancellation(updated);
    }

    return updated;
  }

  // ─── Eliminar (admin) ────────────────────────────────
  async remove(id: number) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!reservation) throw new NotFoundException('Reservación no encontrada');

    // Notificar cancelación si no estaba ya cancelada
    if (reservation.status !== ReservationStatus.CANCELLED) {
      await this.notifications.sendCancellation(reservation);
    }

    return this.prisma.reservation.delete({ where: { id } });
  }

  // ─── Enviar recordatorio manual (admin) ─────────────
  async sendReminder(id: number, type: 'REMINDER_60' | 'REMINDER_30' | 'REMINDER_15' | 'CUSTOM') {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!reservation) throw new NotFoundException('Reservación no encontrada');
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('No se puede enviar recordatorio a una reserva cancelada');
    }

    await this.notifications.sendReminder(reservation, type);

    // Log del recordatorio
    await this.prisma.reminderLog.create({
      data: { reservationId: id, type },
    });

    return { success: true, message: 'Recordatorio enviado correctamente' };
  }

  // ─── RRULE: expandir a fechas concretas ──────────────
  private buildRRule(dto: PreviewBulkReservationDto): RRule {
    const [y, mo, d] = dto.startDate.split('-').map(Number);
    const dtstart = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));

    // Calcular UNTIL = startDate + durationValue * unit
    const until = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59));
    switch (dto.durationUnit) {
      case 'DAYS':
        until.setUTCDate(until.getUTCDate() + dto.durationValue);
        break;
      case 'WEEKS':
        until.setUTCDate(until.getUTCDate() + dto.durationValue * 7);
        break;
      case 'MONTHS':
        until.setUTCMonth(until.getUTCMonth() + dto.durationValue);
        break;
      case 'YEARS':
        until.setUTCFullYear(until.getUTCFullYear() + dto.durationValue);
        break;
    }

    const freqMap: Record<string, Frequency> = {
      DAILY: RRule.DAILY,
      WEEKLY: RRule.WEEKLY,
      MONTHLY: RRule.MONTHLY,
    };

    const options: any = {
      freq: freqMap[dto.frequency],
      dtstart,
      until,
      interval: dto.interval && dto.interval > 0 ? dto.interval : 1,
    };

    if (dto.frequency === 'WEEKLY' && dto.byWeekday && dto.byWeekday.length > 0) {
      options.byweekday = dto.byWeekday.map((d) => WEEKDAY_TO_RRULE[d]);
    }
    if (dto.frequency === 'MONTHLY' && dto.byMonthDay) {
      options.bymonthday = dto.byMonthDay;
    }

    return new RRule(options);
  }

  // ─── Preview bulk (no crea, solo simula) ─────────────
  async previewBulk(dto: PreviewBulkReservationDto): Promise<BulkPreviewResult> {
    // Validar sala
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException('La sala no existe');

    // Validar mínimo de personas
    if (room.minAttendees && dto.attendees < room.minAttendees) {
      throw new BadRequestException(
        `${room.name} requiere un mínimo de ${room.minAttendees} personas para ser reservada`,
      );
    }

    // Validar horario base
    this.validateSchedule(dto.startTime, dto.endTime);

    // Expandir RRULE
    const rule = this.buildRRule(dto);
    const allDates = rule.all();

    if (allDates.length === 0) {
      throw new BadRequestException(
        'La combinación de recurrencia y duración no genera ninguna fecha. Revisa los parámetros.',
      );
    }

    if (allDates.length > 730) {
      throw new BadRequestException(
        `La serie generaría ${allDates.length} reservas. El máximo permitido es 730 (~2 años diarios).`,
      );
    }

    const dates: BulkPreviewDate[] = [];
    let ok = 0;
    let conflicts = 0;
    let weekend = 0;
    let outOfHours = 0;
    let past = 0;

    for (const d of allDates) {
      const isoDate = toISODate(d);
      let status: BulkDateStatus = 'OK';
      let conflictWith: BulkPreviewDate['conflictWith'];
      let reason: string | undefined;

      if (isPastDateTime(isoDate, dto.startTime)) {
        status = 'PAST';
        past++;
        reason = 'Fecha/hora en el pasado';
      } else if (!isWeekday(isoDate)) {
        status = 'WEEKEND';
        weekend++;
        reason = 'Sábado o domingo';
      } else {
        // Validar horario (lanza si fuera de rango)
        try {
          this.validateSchedule(dto.startTime, dto.endTime);
        } catch (e: any) {
          status = 'OUT_OF_HOURS';
          outOfHours++;
          reason = e?.message ?? 'Horario fuera de rango';
        }

        if (status === 'OK') {
          const conflict = await this.findOverlap(dto.roomId, isoDate, dto.startTime, dto.endTime);
          if (conflict) {
            status = 'CONFLICT';
            conflicts++;
            conflictWith = {
              id: conflict.id,
              startTime: conflict.startTime,
              endTime: conflict.endTime,
              requesterName: conflict.requesterName,
            };
            reason = `Reserva existente ${conflict.startTime}-${conflict.endTime} (${conflict.requesterName})`;
          } else {
            ok++;
          }
        }
      }

      dates.push({ date: isoDate, status, conflictWith, reason });
    }

    return {
      rrule: rule.toString(),
      startTime: dto.startTime,
      endTime: dto.endTime,
      totalDates: allDates.length,
      summary: { ok, conflicts, weekend, outOfHours, past },
      dates,
    };
  }

  // ─── Crear bulk (serie + reservas) ───────────────────
  async createBulk(dto: CreateBulkReservationDto) {
    const preview = await this.previewBulk(dto);
    const invalid =
      preview.summary.conflicts +
      preview.summary.weekend +
      preview.summary.outOfHours +
      preview.summary.past;

    if (!dto.skipConflicts && invalid > 0) {
      throw new ConflictException({
        message:
          'La serie tiene fechas inválidas. Activa "omitir conflictos" o ajusta los parámetros.',
        preview,
      });
    }

    const okDates = preview.dates.filter((d) => d.status === 'OK');
    if (okDates.length === 0) {
      throw new BadRequestException('No hay fechas válidas para crear en esta serie.');
    }

    const firstDate = new Date(okDates[0].date + 'T00:00:00.000Z');
    const lastDate = new Date(okDates[okDates.length - 1].date + 'T00:00:00.000Z');

    const result = await this.prisma.$transaction(async (tx) => {
      const series = await tx.reservationSeries.create({
        data: {
          roomId: dto.roomId,
          requesterName: dto.requesterName,
          email: dto.email,
          phone: dto.phone,
          attendees: dto.attendees,
          topic: dto.topic,
          startTime: dto.startTime,
          endTime: dto.endTime,
          rrule: preview.rrule,
          firstDate,
          lastDate,
          totalCount: okDates.length,
          status: SeriesStatus.ACTIVE,
        },
      });

      for (const d of okDates) {
        await tx.reservation.create({
          data: {
            roomId: dto.roomId,
            seriesId: series.id,
            date: new Date(d.date + 'T00:00:00.000Z'),
            startTime: dto.startTime,
            endTime: dto.endTime,
            requesterName: dto.requesterName,
            email: dto.email,
            phone: dto.phone,
            attendees: dto.attendees,
            topic: dto.topic,
            status: ReservationStatus.CONFIRMED,
          },
        });
      }

      const fullSeries = await tx.reservationSeries.findUnique({
        where: { id: series.id },
        include: {
          room: true,
          reservations: { orderBy: [{ date: 'asc' }] },
        },
      });
      return fullSeries!;
    });

    // Correo único de resumen
    await this.notifications.sendSeriesSummary(result);

    return {
      series: result,
      createdCount: okDates.length,
      skippedCount: preview.totalDates - okDates.length,
      skipped: preview.dates.filter((d) => d.status !== 'OK'),
    };
  }

  // ─── Detalle de serie ────────────────────────────────
  async getSeries(id: number) {
    const series = await this.prisma.reservationSeries.findUnique({
      where: { id },
      include: {
        room: true,
        reservations: { orderBy: [{ date: 'asc' }, { startTime: 'asc' }] },
      },
    });
    if (!series) throw new NotFoundException('Serie no encontrada');
    return series;
  }

  // ─── Cancelar serie (futuras → CANCELLED) ────────────
  async cancelSeries(id: number) {
    const series = await this.getSeries(id);
    if (series.status === SeriesStatus.CANCELLED) {
      throw new BadRequestException('La serie ya está cancelada');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.reservationSeries.update({
        where: { id },
        data: { status: SeriesStatus.CANCELLED },
      });

      const cancelled = await tx.reservation.updateMany({
        where: {
          seriesId: id,
          date: { gte: today },
          status: { not: ReservationStatus.CANCELLED },
        },
        data: { status: ReservationStatus.CANCELLED },
      });

      return cancelled.count;
    });

    const updated = await this.getSeries(id);
    await this.notifications.sendSeriesCancellation(updated);

    return { success: true, cancelledCount: result, series: updated };
  }

  // ─── Eliminar serie (borra futuras, conserva pasadas) ─
  async deleteSeries(id: number) {
    const series = await this.getSeries(id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.$transaction(async (tx) => {
      // Borrar reservas futuras de la serie
      await tx.reservation.deleteMany({
        where: {
          seriesId: id,
          date: { gte: today },
        },
      });
      // Las pasadas quedan con seriesId = null (onDelete SetNull)
      await tx.reservationSeries.delete({ where: { id } });
    });

    return { success: true, deletedSeriesId: id, requesterName: series.requesterName };
  }

  // ─── Para el cron: reservas próximas ────────────────
  async findUpcoming(minutesAhead: number) {
    const now = new Date();
    const target = new Date(now.getTime() + minutesAhead * 60 * 1000);

    // Usar hora local consistentemente: las startTime se guardan en hora local
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const targetDate = `${year}-${month}-${day}`;
    const targetHour = target.getHours().toString().padStart(2, '0');
    const targetMinBlock = target.getMinutes() < 30 ? '00' : '30';
    const targetTime = `${targetHour}:${targetMinBlock}`;

    return this.prisma.reservation.findMany({
      where: {
        date: new Date(targetDate + 'T00:00:00.000Z'),
        startTime: targetTime,
        status: ReservationStatus.CONFIRMED,
      },
      include: { room: true, remindersSent: true },
    });
  }
}
