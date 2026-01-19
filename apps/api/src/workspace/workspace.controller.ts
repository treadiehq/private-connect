import { Controller, Get, Post, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';

@ApiTags('Workspace')
@Controller('v1/workspace')
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create workspace (deprecated)', description: 'This endpoint is deprecated. Use POST /v1/auth/register instead.' })
  @ApiResponse({ status: 410, description: 'Gone - use /v1/auth/register' })
  async createWorkspace() {
    throw new HttpException(
      'Workspace creation is now part of user registration. Use POST /v1/auth/register instead.',
      HttpStatus.GONE
    );
  }

  @Get()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get workspace', description: 'Returns workspace details and usage information.' })
  @ApiResponse({ status: 200, description: 'Workspace details' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async getWorkspace(@Headers('x-api-key') apiKey: string) {
    if (!apiKey) {
      throw new HttpException('API key required', HttpStatus.UNAUTHORIZED);
    }

    const workspace = await this.workspaceService.findByApiKey(apiKey);
    if (!workspace) {
      throw new HttpException('Invalid API key', HttpStatus.UNAUTHORIZED);
    }

    return this.workspaceService.getUsage(workspace.id);
  }

  @Post('upgrade')
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Upgrade workspace', description: 'Upgrades the workspace to PRO plan.' })
  @ApiResponse({ status: 200, description: 'Workspace upgraded' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async upgrade(@Headers('x-api-key') apiKey: string) {
    if (!apiKey) {
      throw new HttpException('API key required', HttpStatus.UNAUTHORIZED);
    }

    const workspace = await this.workspaceService.findByApiKey(apiKey);
    if (!workspace) {
      throw new HttpException('Invalid API key', HttpStatus.UNAUTHORIZED);
    }

    const updated = await this.workspaceService.upgradeToPro(workspace.id);
    
    return {
      success: true,
      message: 'Upgraded to PRO plan',
      plan: updated.plan,
    };
  }
}
