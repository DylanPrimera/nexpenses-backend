import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleDto } from './dto/google.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { MigrateDto } from './dto/migrate.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

const YEAR_SECONDS = 60 * 60 * 24 * 365;

export const publicUserSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  budget: true,
  cycleStartedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email is already in use');

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: firstName,
        password: await bcrypt.hash(dto.password, 10),
        budget: 0,
      },
      select: publicUserSelect,
    });
    return { user, token: this.sign(user) };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, password: true },
    });
    if (!user?.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(dto.password, user.password);
    if (!matches) throw new UnauthorizedException('Invalid credentials');
    const { password: _password, ...safe } = user;
    return { user: safe, token: this.sign(safe) };
  }

  async google(dto: GoogleDto) {
    const profile = await this.verifyGoogle(dto.idToken);
    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { ...publicUserSelect, password: true },
    });
    if (existing?.password) {
      throw new ConflictException('Email is already in use');
    }
    if (existing) {
      const { password: _password, ...safe } = existing;
      return { user: safe, token: this.sign(safe) };
    }
    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        name: profile.firstName,
        password: null,
        budget: 0,
      },
      select: publicUserSelect,
    });
    return { user, token: this.sign(user) };
  }

  async migrate(dto: MigrateDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, password: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.password) {
      throw new ConflictException('Account already exists');
    }
    if (!user.email.endsWith('@users.nexpenses.invalid')) {
      throw new ConflictException('Account already exists');
    }

    if (dto.idToken) {
      const profile = await this.verifyGoogle(dto.idToken);
      await this.assertEmailAvailable(profile.email, user.id);
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          name: profile.firstName,
          password: null,
        },
        select: publicUserSelect,
      });
      return { user: updated, token: this.sign(updated) };
    }

    if (!dto.email || !dto.password || !dto.firstName || !dto.lastName) {
      throw new BadRequestException('Email and password are required');
    }
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    await this.assertEmailAvailable(email, user.id);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        firstName,
        lastName,
        name: firstName,
        password: await bcrypt.hash(dto.password, 10),
      },
      select: publicUserSelect,
    });
    return { user: updated, token: this.sign(updated) };
  }

  me(user: PublicUser) {
    return { user, token: this.sign(user) };
  }

  private sign(user: { id: string; email: string }) {
    const payload: JwtPayload = { userId: user.id, email: user.email };
    return this.jwtService.sign(payload, { expiresIn: YEAR_SECONDS });
  }

  private async assertEmailAvailable(email: string, userId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (owner && owner.id !== userId) {
      throw new ConflictException('Email is already in use');
    }
  }

  private async verifyGoogle(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new BadRequestException('Google is not configured');
    }
    if (!this.googleClient) this.googleClient = new OAuth2Client(clientId);
    let payload: {
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
      name?: string;
    } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
    const email = payload?.email?.trim().toLowerCase();
    if (!email || payload?.email_verified === false) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const given = payload?.given_name?.trim() || payload?.name?.split(/\s+/)[0] || 'User';
    return {
      email,
      firstName: given.slice(0, 20),
      lastName: (payload?.family_name?.trim() || '').slice(0, 80),
    };
  }
}
