import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationsService } from '../reservations/reservations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderType } from '@prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private reservations: ReservationsService,
    private notifications: NotificationsService,
    private prisma: PrismaService,
  ) {}

  // Ejecutar cada 15 minutos, de lunes a viernes, entre 7am y 6pm
  @Cron('0,15,30,45 7-17 * * 1-5', { name: 'check-reminders' })
  async checkAndSendReminders() {
    this.logger.log('Verificando recordatorios automaticos...');

    await Promise.all([
      this.sendRemindersFor(60, 'REMINDER_60'),
      this.sendRemindersFor(30, 'REMINDER_30'),
      this.sendRemindersFor(15, 'REMINDER_15'),
    ]);
  }

  private async sendRemindersFor(
    minutesAhead: number,
    type: ReminderType,
  ) {
    const upcoming = await this.reservations.findUpcoming(minutesAhead);

    for (const reservation of upcoming) {
      // Verificar si ya se envio este tipo de recordatorio
      const alreadySent = reservation.remindersSent.some((r) => r.type === type);
      if (alreadySent) continue;

      try {
        await this.notifications.sendReminder(reservation as any, type as any);

        // Log del recordatorio
        await this.prisma.reminderLog.create({
          data: { reservationId: reservation.id, type },
        });

        this.logger.log(
          `Recordatorio ${type} enviado a ${reservation.email} para reserva #${reservation.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Error enviando recordatorio ${type} para reserva #${reservation.id}: ${error.message}`,
        );
      }
    }
  }
}
