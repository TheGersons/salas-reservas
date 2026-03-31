import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { RoomsModule } from "./rooms/rooms.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SchedulerModule } from "./scheduler/scheduler.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    RoomsModule,
    ReservationsModule,
    NotificationsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
