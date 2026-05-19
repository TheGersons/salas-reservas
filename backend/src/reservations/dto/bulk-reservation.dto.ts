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
  Max,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type DurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

const TIME_REGEX = /^([01]\d|2[0-3]):[03]0$/;
const TIME_MESSAGE = 'Formato HH:mm en bloques de 30 minutos (ej: 07:00, 07:30, 08:00...)';

export class PreviewBulkReservationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  roomId: number;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '08:00' })
  @Matches(TIME_REGEX, { message: `startTime: ${TIME_MESSAGE}` })
  startTime: string;

  @ApiProperty({ example: '10:00' })
  @Matches(TIME_REGEX, { message: `endTime: ${TIME_MESSAGE}` })
  endTime: string;

  @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'MONTHLY'] })
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY'])
  frequency: Frequency;

  @ApiPropertyOptional({ example: 1, description: 'Intervalo de repetición (cada N)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  interval?: number = 1;

  @ApiPropertyOptional({
    type: [String],
    example: ['MO', 'WE'],
    description: 'Días de la semana (solo para WEEKLY)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'], { each: true })
  byWeekday?: Weekday[];

  @ApiPropertyOptional({ example: 15, description: 'Día del mes (solo para MONTHLY)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  byMonthDay?: number;

  @ApiProperty({ example: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  durationValue: number;

  @ApiProperty({ enum: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'] })
  @IsEnum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS'])
  durationUnit: DurationUnit;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attendees: number;
}

export class CreateBulkReservationDto extends PreviewBulkReservationDto {
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

  @ApiPropertyOptional({ example: 'Reunión semanal de equipo' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  topic?: string;

  @ApiProperty({
    example: false,
    description: 'Si true, omite las fechas con conflicto/inválidas y crea el resto',
    default: false,
  })
  @IsBoolean()
  skipConflicts: boolean;
}
