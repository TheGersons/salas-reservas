import {
  IsDateString,
  IsEmail,
  IsInt,
  IsString,
  Matches,
  MinLength,
  IsOptional,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';

export class CreateReservationDto {
  @ApiProperty({ example: 1, description: 'ID de la sala' })
  @IsInt()
  roomId: number;

  @ApiProperty({ example: '2025-06-15', description: 'Fecha (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '09:00', description: 'Hora de inicio (HH:mm, bloques de 30 min, 07:00-18:00)' })
  @Matches(/^([01]\d|2[0-3]):[03]0$/, {
    message: 'startTime debe ser en formato HH:mm en bloques de 30 minutos (ej: 07:00, 07:30, 08:00...)',
  })
  startTime: string;

  @ApiProperty({ example: '10:30', description: 'Hora de fin (HH:mm, bloques de 30 min, hasta 18:00)' })
  @Matches(/^([01]\d|2[0-3]):[03]0$/, {
    message: 'endTime debe ser en formato HH:mm en bloques de 30 minutos',
  })
  endTime: string;

  @ApiProperty({ example: 'Juan Pérez García' })
  @IsString()
  @MinLength(3)
  requesterName: string;

  @ApiProperty({ example: 'juan.perez@empresa.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email: string;

  @ApiProperty({ example: '+504 9999-8888' })
  @IsString()
  @MinLength(8)
  phone: string;

  @ApiProperty({ example: 5, description: 'Cantidad de personas que asistirán' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attendees: number;

  @ApiPropertyOptional({ example: 'Revisión de presupuesto Q2', description: 'Tema a tratar (solo visible para admin)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  topic?: string;
}

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  status: ReservationStatus;
}

export class GetReservationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roomId?: number;

  @ApiPropertyOptional({ example: '2025-06-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2025-06-09' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2025-06-15' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
