import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@kilimanjaro/types';
import * as crypto from 'crypto';

@Injectable()
export class TokensService {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  // ─── Generate access token (15min) ────────────────────────────────────────
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
  }

  // ─── Generate & store refresh token (7d) ─────────────────────────────────
  async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });

    return token;
  }

  // ─── Validate refresh token ───────────────────────────────────────────────
  async validateRefreshToken(token: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) return null;
    if (record.isRevoked) return null;
    if (record.expiresAt < new Date()) return null;

    return record;
  }

  // ─── Revoke refresh token (logout) ───────────────────────────────────────
  async revokeRefreshToken(token: string) {
    await this.prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true },
    });
  }

  // ─── Revoke all tokens for user (force logout all devices) ───────────────
  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // ─── Verify access token ─────────────────────────────────────────────────
  verifyAccessToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.verify(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
  }
}
