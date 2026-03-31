import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import {
  ReservationsController,
  AdminReservationsController,
} from './reservations.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ReservationsService],
  controllers: [ReservationsController, AdminReservationsController],
  exports: [ReservationsService],
})
export class ReservationsModule {}
