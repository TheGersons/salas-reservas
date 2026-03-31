import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  UpdateReservationStatusDto,
  GetReservationsQueryDto,
} from './dto/reservation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SendReminderDto {
  @ApiProperty({ enum: ['REMINDER_60', 'REMINDER_30', 'REMINDER_15', 'CUSTOM'] })
  @IsEnum(['REMINDER_60', 'REMINDER_30', 'REMINDER_15', 'CUSTOM'])
  type: 'REMINDER_60' | 'REMINDER_30' | 'REMINDER_15' | 'CUSTOM';
}

// ─── RUTAS PÚBLICAS ────────────────────────────────────
@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener reservaciones (calendario público)' })
  @ApiQuery({ name: 'roomId', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  findPublic(@Query() query: GetReservationsQueryDto) {
    return this.reservationsService.findPublic(query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva reservación (público)' })
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }
}

// ─── RUTAS ADMIN ───────────────────────────────────────
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/reservations')
export class AdminReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Listar todas las reservaciones con datos completos' })
  findAll(@Query() query: GetReservationsQueryDto) {
    return this.reservationsService.findAll(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '[Admin] Actualizar estado de reservación' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    return this.reservationsService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Eliminar reservación' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.remove(id);
  }

  @Post(':id/remind')
  @ApiOperation({ summary: '[Admin] Enviar recordatorio manual al solicitante' })
  sendReminder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendReminderDto,
  ) {
    return this.reservationsService.sendReminder(id, dto.type);
  }
}
