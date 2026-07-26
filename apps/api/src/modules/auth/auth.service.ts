import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../middleware/error';
import type { LoginInput, SignupInput } from '@seeker/shared';

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  onboarded: boolean;
}

function toPublicUser(u: { id: string; email: string; name: string; avatarUrl: string | null; onboarded: boolean }): PublicUser {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, onboarded: u.onboarded };
}

function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokens(userId: string, email: string): Promise<AuthTokens> {
  const accessToken = signAccessToken(userId, email);
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken };
}

export async function signup(input: SignupInput): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(input.password, 11);
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash },
  });
  return { user: toPublicUser(user), tokens: await issueTokens(user.id, user.email) };
}

export async function login(input: LoginInput): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user?.passwordHash) throw ApiError.unauthorized('Invalid email or password', 'BAD_CREDENTIALS');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password', 'BAD_CREDENTIALS');
  return { user: toPublicUser(user), tokens: await issueTokens(user.id, user.email) };
}

/** Verify a Google ID token (from Google Identity Services) and upsert the user. */
export async function googleAuth(credential: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  if (!googleClient) {
    throw ApiError.badRequest('Google sign-in is not configured on this server', 'GOOGLE_DISABLED');
  }
  const ticket = await googleClient
    .verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID })
    .catch(() => null);
  const payload = ticket?.getPayload();
  if (!payload?.email || !payload.sub) throw ApiError.unauthorized('Google token invalid');

  const user = await prisma.user.upsert({
    where: { email: payload.email.toLowerCase() },
    update: { googleId: payload.sub, avatarUrl: payload.picture ?? undefined },
    create: {
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email.split('@')[0] ?? 'Investor',
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
    },
  });
  return { user: toPublicUser(user), tokens: await issueTokens(user.id, user.email) };
}

/** Rotate a refresh token → new access + refresh pair. */
export async function refresh(refreshToken: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token invalid — sign in again', 'REFRESH_INVALID');
  }
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return {
    user: toPublicUser(record.user),
    tokens: await issueTokens(record.user.id, record.user.email),
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}
