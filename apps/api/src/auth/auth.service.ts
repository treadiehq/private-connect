import { Injectable, Logger, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { randomBytes, createHash } from 'crypto';
import { isAdminEmail } from '../common/admin';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Reserved workspace names that cannot be used
const RESERVED_WORKSPACE_NAMES = [
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'blog',
  'cdn',
  'connect',
  'dashboard',
  'demo',
  'dev',
  'docs',
  'help',
  'home',
  'hub',
  'internal',
  'login',
  'mail',
  'privateconnect',
  'private-connect',
  'prod',
  'production',
  'register',
  'root',
  'settings',
  'signup',
  'staging',
  'status',
  'support',
  'system',
  'test',
  'www',
  'privateconnect',
  'private-connect',
  'privateconnect.co',
  'private-connect.co',
  'treadie',
  'airatelimit',
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Register: create user + workspace, send magic link
  async register(email: string, workspaceName: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedWorkspaceName = workspaceName.trim();

    // Validate workspace name
    if (!normalizedWorkspaceName || normalizedWorkspaceName.length < 2) {
      throw new BadRequestException('Workspace name must be at least 2 characters');
    }

    if (normalizedWorkspaceName.length > 50) {
      throw new BadRequestException('Workspace name must be less than 50 characters');
    }

    // Check for reserved names
    if (RESERVED_WORKSPACE_NAMES.includes(normalizedWorkspaceName.toLowerCase())) {
      throw new BadRequestException('This workspace name is reserved. Please choose a different name.');
    }

    // Registration is an unauthenticated system operation — bypass RLS
    // since there's no workspace context yet
    return this.prisma.withoutRls(async () => {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ConflictException('An account with this email already exists. Please login instead.');
      }

      // Check if workspace name already exists
      const existingWorkspace = await this.prisma.workspace.findUnique({
        where: { name: normalizedWorkspaceName },
      });

      if (existingWorkspace) {
        throw new ConflictException('A workspace with this name already exists. Please choose a different name.');
      }

      // Create user, workspace, and initial API key in a transaction
      const { user, workspace, apiKey } = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
          },
        });

        const workspace = await tx.workspace.create({
          data: {
            name: normalizedWorkspaceName,
            ownerId: user.id,
          },
        });

        // Create initial API key — store only the hash, return raw key once
        const key = `pc_${randomBytes(24).toString('hex')}`;
        const keyPrefix = key.slice(0, 11);
        const apiKey = await tx.apiKey.create({
          data: {
            workspaceId: workspace.id,
            name: 'Default',
            keyHash: hashApiKey(key),
            keyPrefix,
          },
        });

        return { user, workspace, apiKey };
      });

      // Create magic link
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await this.prisma.magicLink.create({
        data: {
          userId: user.id,
          token: hashToken(token),
          type: 'REGISTER',
          expiresAt,
        },
      });

      await this.emailService.sendMagicLink({
        to: normalizedEmail,
        token,
        type: 'REGISTER',
        workspaceName,
      });

      return { message: 'Check your email for a magic link to complete registration' };
    });
  }

  // Login: send magic link to existing user (same response whether account exists or not — prevents user enumeration)
  async login(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const genericMessage = 'If an account exists with this email, you will receive a magic link';

    // Login is unauthenticated — bypass RLS
    return this.prisma.withoutRls(async () => {
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        if (process.env.NODE_ENV !== 'production') {
          this.logger.warn(`Login attempted for non-existent email: ${normalizedEmail} — no magic link sent. Did you mean to register?`);
        }
        return { message: genericMessage };
      }

      // Invalidate any existing unused magic links
      await this.prisma.magicLink.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(), // Mark as used to invalidate
        },
      });

      // Create new magic link
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await this.prisma.magicLink.create({
        data: {
          userId: user.id,
          token: hashToken(token),
          type: 'LOGIN',
          expiresAt,
        },
      });

      await this.emailService.sendMagicLink({
        to: normalizedEmail,
        token,
        type: 'LOGIN',
      });

      return { message: genericMessage };
    });
  }

  // Verify magic link and create session
  async verifyMagicLink(token: string, userAgent?: string, ipAddress?: string): Promise<{
    sessionToken: string;
    user: { id: string; email: string };
    workspace: { id: string; name: string; apiKey: string } | null;
    isNewUser: boolean;
  }> {
    const sessionToken = randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Magic link verification is unauthenticated — bypass RLS
    return this.prisma.withoutRls(async () => {
      try {
        // Perform all validation and updates inside transaction to prevent TOCTOU race
        const result = await this.prisma.$transaction(async (tx) => {
          const magicLink = await tx.magicLink.findUnique({
            where: { token: hashToken(token) },
            include: { user: { include: { workspaces: { include: { apiKeys: { where: { revokedAt: null }, take: 1 } } } } } },
          });

          if (!magicLink) {
            throw new UnauthorizedException('Invalid or expired magic link');
          }

          // Validate inside transaction with fresh data
          if (magicLink.usedAt) {
            throw new UnauthorizedException('This magic link has already been used');
          }

          if (magicLink.expiresAt < new Date()) {
            throw new UnauthorizedException('This magic link has expired');
          }

          // Mark magic link as used with optimistic lock (only update if still unused)
          const updateResult = await tx.magicLink.updateMany({
            where: {
              id: magicLink.id,
              usedAt: null, // Optimistic lock: only update if still null
            },
            data: { usedAt: new Date() },
          });

          // If no rows were updated, another request already used this link
          if (updateResult.count === 0) {
            throw new UnauthorizedException('This magic link has already been used');
          }

          // Mark user as verified if registering
          if (magicLink.type === 'REGISTER' && !magicLink.user.emailVerified) {
            await tx.user.update({
              where: { id: magicLink.userId },
              data: { emailVerified: true },
            });
          }

          await tx.authSession.create({
            data: {
              userId: magicLink.userId,
              token: hashToken(sessionToken),
              expiresAt: sessionExpiresAt,
              userAgent,
              ipAddress,
            },
          });

          return magicLink;
        });

        const workspace = result.user.workspaces[0] || null;
        const apiKey = workspace?.apiKeys?.[0] || null;
        const isNewUser = result.type === 'REGISTER';

        return {
          sessionToken,
          isNewUser,
          user: {
            id: result.user.id,
            email: result.user.email,
          },
          workspace: workspace ? {
            id: workspace.id,
            name: workspace.name,
            apiKey: apiKey?.keyPrefix ? `${apiKey.keyPrefix}...` : '',
          } : null,
        };
      } catch (error) {
        // Re-throw UnauthorizedException as-is
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        // For any other errors, throw a generic error
        throw new UnauthorizedException('Failed to verify magic link');
      }
    });
  }

  // Validate session token
  async validateSession(token: string): Promise<{
    user: { id: string; email: string; emailVerified: boolean; isAdmin: boolean };
    workspace: { id: string; name: string } | null;
  } | null> {
    // Session validation runs before workspace context is established — bypass RLS
    return this.prisma.withoutRls(async () => {
      const session = await this.prisma.authSession.findUnique({
        where: { token: hashToken(token) },
        include: { user: { include: { workspaces: true } } },
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      // Update last used timestamp
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });

      const workspace = session.user.workspaces[0] || null;

      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
          isAdmin: isAdminEmail(session.user.email),
        },
        workspace: workspace ? {
          id: workspace.id,
          name: workspace.name,
        } : null,
      };
    });
  }

  async logout(token: string): Promise<void> {
    await this.prisma.withoutRls(() =>
      this.prisma.authSession.delete({
        where: { token: hashToken(token) },
      }).catch(() => {})
    );
  }

  // Get current user
  async getCurrentUser(token: string) {
    const session = await this.validateSession(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    return session;
  }

  // Get workspace owner (for API key authenticated requests)
  async getWorkspaceOwner(workspaceId: string): Promise<{ ownerId: string; ownerEmail: string } | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!workspace) {
      return null;
    }

    return {
      ownerId: workspace.ownerId,
      ownerEmail: workspace.owner.email,
    };
  }
}

