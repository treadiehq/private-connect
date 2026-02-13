import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';

@ApiTags('Workspace')
@Controller('v1/workspace')
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get workspace', description: 'Returns workspace details and usage information.' })
  @ApiResponse({ status: 200, description: 'Workspace details' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  @ApiResponse({ status: 403, description: 'IP address not allowed' })
  async getWorkspace(@Req() req: any) {
    return this.workspaceService.getUsage(req.workspace.id);
  }

  @Post('upgrade')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Upgrade workspace', description: 'Upgrades the workspace to PRO plan.' })
  @ApiResponse({ status: 200, description: 'Workspace upgraded' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  @ApiResponse({ status: 403, description: 'IP address not allowed' })
  async upgrade(@Req() req: any) {
    const updated = await this.workspaceService.upgradeToPro(req.workspace.id);

    return {
      success: true,
      message: 'Upgraded to PRO plan',
      plan: updated.plan,
    };
  }
}
