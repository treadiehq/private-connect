import { Controller, Get, Post, Put, Delete, Body, Param, Req, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeysService } from './api-keys.service';
import { AuthService } from '../auth/auth.service';

interface CreateApiKeyDto {
  name: string;
}

interface UpdateIpRestrictionsDto {
  allowedIpRanges: string[];
}

@Controller('v1/api-keys')
export class ApiKeysController {
  constructor(
    private apiKeysService: ApiKeysService,
    private authService: AuthService,
  ) {}

  private async getWorkspaceFromSession(req: Request) {
    const token = req.cookies?.session;
    if (!token) {
      throw new HttpException('Not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.authService.validateSession(token);
    if (!session || !session.workspace) {
      throw new HttpException('Not authenticated or no workspace', HttpStatus.UNAUTHORIZED);
    }

    return session.workspace;
  }

  @Get()
  async listApiKeys(@Req() req: Request) {
    const workspace = await this.getWorkspaceFromSession(req);
    return this.apiKeysService.listApiKeys(workspace.id);
  }

  @Get(':id')
  async getApiKey(@Req() req: Request, @Param('id') id: string) {
    const workspace = await this.getWorkspaceFromSession(req);
    return this.apiKeysService.getApiKey(workspace.id, id);
  }

  @Post()
  async createApiKey(@Req() req: Request, @Body() body: CreateApiKeyDto) {
    const workspace = await this.getWorkspaceFromSession(req);

    if (!body.name || body.name.trim().length < 1) {
      throw new HttpException('Name is required', HttpStatus.BAD_REQUEST);
    }

    if (body.name.trim().length > 50) {
      throw new HttpException('Name must be less than 50 characters', HttpStatus.BAD_REQUEST);
    }

    return this.apiKeysService.createApiKey(workspace.id, body.name);
  }

  @Put(':id/ip-restrictions')
  async updateIpRestrictions(
    @Req() req: Request, 
    @Param('id') id: string,
    @Body() body: UpdateIpRestrictionsDto
  ) {
    const workspace = await this.getWorkspaceFromSession(req);

    if (!Array.isArray(body.allowedIpRanges)) {
      throw new HttpException('allowedIpRanges must be an array', HttpStatus.BAD_REQUEST);
    }

    return this.apiKeysService.updateIpRestrictions(workspace.id, id, body.allowedIpRanges);
  }

  @Delete(':id')
  async revokeApiKey(@Req() req: Request, @Param('id') id: string) {
    const workspace = await this.getWorkspaceFromSession(req);
    await this.apiKeysService.revokeApiKey(workspace.id, id);
    return { success: true };
  }
}

