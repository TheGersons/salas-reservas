import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const payload = { sub: admin.id, email: admin.email, role: 'admin' };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    };
  }

  async validateAdmin(id: number) {
    return this.prisma.admin.findUnique({ where: { id } });
  }
}
