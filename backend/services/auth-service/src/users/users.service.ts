import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, LoginType } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ─── Find by email (staff/parents) ───────────────────────────────────────
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // ─── Find by registration number (students) ───────────────────────────────
  async findByRegistrationNumber(registrationNumber: string) {
    return this.prisma.user.findUnique({ where: { registrationNumber } });
  }

  // ─── Find by ID ───────────────────────────────────────────────────────────
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── Create user (email-based) ────────────────────────────────────────────
  async createEmailUser(data: {
    email: string;
    password: string;
    role: Role;
    schoolId: string;
  }) {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(data.password);

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        loginType: LoginType.EMAIL,
        schoolId: data.schoolId,
      },
    });
  }

  // ─── Create student user (registration number) ────────────────────────────
  async createStudentUser(data: {
    registrationNumber: string;
    password: string;
    schoolId: string;
  }) {
    const existing = await this.findByRegistrationNumber(data.registrationNumber);
    if (existing) throw new ConflictException('Registration number already in use');

    const passwordHash = await argon2.hash(data.password);

    return this.prisma.user.create({
      data: {
        registrationNumber: data.registrationNumber,
        passwordHash,
        role: Role.STUDENT,
        loginType: LoginType.REGISTRATION_NUMBER,
        schoolId: data.schoolId,
      },
    });
  }

  // ─── Verify password ──────────────────────────────────────────────────────
  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }

  // ─── Update last login ────────────────────────────────────────────────────
  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  // ─── Deactivate user ──────────────────────────────────────────────────────
  async deactivate(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
