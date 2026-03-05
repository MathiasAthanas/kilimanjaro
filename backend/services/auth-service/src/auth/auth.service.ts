import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TokensService } from '../tokens/tokens.service';
import { AuditService } from './audit.service';
import { EmailLoginDto, StudentLoginDto, CreateUserDto } from './dto/login.dto';
import { Role, LoginType } from '@prisma/client';
import { JwtPayload } from '@kilimanjaro/types';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private tokens: TokensService,
    private audit: AuditService,
  ) {}

  // ─── Email Login ──────────────────────────────────────────────────────────
  async loginWithEmail(dto: EmailLoginDto, meta: { ip: string; ua: string }) {
    const user = await this.users.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.loginType !== LoginType.EMAIL) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.users.verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      await this.audit.log(user.id, 'LOGIN_FAILED', meta);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.users.updateLastLogin(user.id);
    await this.audit.log(user.id, 'LOGIN_SUCCESS', meta);

    return this.issueTokens(user);
  }

  // ─── Student Login (registration number) ─────────────────────────────────
  async loginWithRegistrationNumber(
    dto: StudentLoginDto,
    meta: { ip: string; ua: string },
  ) {
    const user = await this.users.findByRegistrationNumber(dto.registrationNumber);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.users.verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      await this.audit.log(user.id, 'LOGIN_FAILED', meta);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.users.updateLastLogin(user.id);
    await this.audit.log(user.id, 'LOGIN_SUCCESS', meta);

    return this.issueTokens(user);
  }

  // ─── Refresh tokens ───────────────────────────────────────────────────────
  async refreshTokens(refreshToken: string) {
    const record = await this.tokens.validateRefreshToken(refreshToken);

    if (!record) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old, issue new
    await this.tokens.revokeRefreshToken(refreshToken);

    return this.issueTokens(record.user);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  async logout(refreshToken: string, userId: string, meta: { ip: string; ua: string }) {
    await this.tokens.revokeRefreshToken(refreshToken);
    await this.audit.log(userId, 'LOGOUT', meta);
    return { message: 'Logged out successfully' };
  }

  // ─── Logout all devices ───────────────────────────────────────────────────
  async logoutAll(userId: string, meta: { ip: string; ua: string }) {
    await this.tokens.revokeAllUserTokens(userId);
    await this.audit.log(userId, 'LOGOUT_ALL_DEVICES', meta);
    return { message: 'Logged out from all devices' };
  }

  // ─── Create user (system admin only) ─────────────────────────────────────
  async createUser(dto: CreateUserDto) {
    if (dto.role === Role.STUDENT) {
      if (!dto.registrationNumber) {
        throw new ForbiddenException('Registration number required for students');
      }
      return this.users.createStudentUser({
        registrationNumber: dto.registrationNumber,
        password: dto.password,
        schoolId: dto.schoolId,
      });
    }

    if (!dto.email) {
      throw new ForbiddenException('Email required for non-student users');
    }

    return this.users.createEmailUser({
      email: dto.email,
      password: dto.password,
      role: dto.role as Role,
      schoolId: dto.schoolId,
    });
  }

  // ─── Issue access + refresh tokens ────────────────────────────────────────
  private async issueTokens(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      loginType: user.loginType,
      schoolId: user.schoolId,
    };

    const accessToken = this.tokens.generateAccessToken(payload);
    const refreshToken = await this.tokens.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        schoolId: user.schoolId,
        email: user.email ?? null,
        registrationNumber: user.registrationNumber ?? null,
      },
    };
  }
}
