import { Controller, Get, Post, Put, Delete, Body, Param, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeysService } from './api-keys.service';
import { AuthService } from '../auth/auth.service';

interface CreateApiKeyDto {
  name: string;
}

interface UpdateIpRestrictionsDto {
  allowedIpRanges: string[];
}

@ApiTags('API Keys')
@ApiBearerAuth('bearer')
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
  @ApiOperation({ summary: 'List API keys', description: 'Returns all API keys for the current workspace.' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async listApiKeys(@Req() req: Request) {
    const workspace = await this.getWorkspaceFromSession(req);
    return this.apiKeysService.listApiKeys(workspace.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key', description: 'Returns details for a specific API key.' })
  @ApiResponse({ status: 200, description: 'API key details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getApiKey(@Req() req: Request, @Param('id') id: string) {
    const workspace = await this.getWorkspaceFromSession(req);
    return this.apiKeysService.getApiKey(workspace.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create API key', description: 'Creates a new API key for the workspace.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'production-key', maxLength: 50 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'API key created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @ApiOperation({ summary: 'Update IP restrictions', description: 'Updates the allowed IP ranges for an API key.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['allowedIpRanges'],
      properties: {
        allowedIpRanges: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['10.0.0.0/8', '192.168.1.0/24'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'IP restrictions updated' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @ApiOperation({ summary: 'Revoke API key', description: 'Revokes an API key. This action cannot be undone.' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revokeApiKey(@Req() req: Request, @Param('id') id: string) {
    const workspace = await this.getWorkspaceFromSession(req);
    await this.apiKeysService.revokeApiKey(workspace.id, id);
    return { success: true };
  }
}

