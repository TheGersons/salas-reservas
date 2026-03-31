import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto, GetReservationsQueryDto } from './dto/reservation.dto';
import { ReservationStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

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

  // ─── Verificar solapamiento ──────────────────────────
  private async checkOverlap(
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

      // Solapamiento: nuevo inicio < existente fin Y nuevo fin > existente inicio
      if (newStart < existEnd && newEnd > existStart) {
        throw new ConflictException(
          `La sala ya tiene una reserva de ${r.startTime} a ${r.endTime} en esa fecha`,
        );
      }
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
