import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las salas (público)' })
  findAll() {
    return this.roomsService.findAll();
  }
}
