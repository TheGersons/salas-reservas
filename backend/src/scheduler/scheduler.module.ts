import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ReservationsModule } from '../reservations/reservations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ReservationsModule, NotificationsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
