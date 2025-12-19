import { Controller, Get, Post, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

@Controller('v1/workspace')
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  // Note: Workspace creation is now handled via /v1/auth/register
  // This endpoint is deprecated
  @Post('create')
  async createWorkspace() {
    throw new HttpException(
      'Workspace creation is now part of user registration. Use POST /v1/auth/register instead.',
      HttpStatus.GONE
    );
  }

  @Get()
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
