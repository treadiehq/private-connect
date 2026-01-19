import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth('bearer')
@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin stats', description: 'Returns dashboard statistics. Requires admin privileges.' })
  @ApiResponse({ status: 200, description: 'Admin statistics' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users', description: 'Returns all users with their workspaces.' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user', description: 'Returns detailed info about a specific user.' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user', description: 'Deletes a user and all associated data.' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Post('users/:id/admin')
  @ApiOperation({ summary: 'Toggle admin status', description: 'Grants or revokes admin privileges for a user.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isAdmin: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Admin status updated' })
  async toggleAdmin(
    @Param('id') id: string,
    @Body() body: { isAdmin: boolean },
  ) {
    return this.adminService.toggleAdmin(id, body.isAdmin);
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'List all workspaces', description: 'Returns all workspaces.' })
  @ApiResponse({ status: 200, description: 'List of workspaces' })
  async getAllWorkspaces() {
    return this.adminService.getAllWorkspaces();
  }

  @Get('workspaces/:id')
  @ApiOperation({ summary: 'Get workspace', description: 'Returns detailed info about a specific workspace.' })
  @ApiResponse({ status: 200, description: 'Workspace details' })
  async getWorkspace(@Param('id') id: string) {
    return this.adminService.getWorkspace(id);
  }

  @Post('workspaces/:id/upgrade')
  @ApiOperation({ summary: 'Upgrade workspace', description: 'Upgrades a workspace to PRO plan.' })
  @ApiResponse({ status: 200, description: 'Workspace upgraded' })
  async upgradeWorkspace(@Param('id') id: string) {
    return this.adminService.upgradeWorkspace(id);
  }

  @Post('workspaces/:id/downgrade')
  @ApiOperation({ summary: 'Downgrade workspace', description: 'Downgrades a workspace to FREE plan.' })
  @ApiResponse({ status: 200, description: 'Workspace downgraded' })
  async downgradeWorkspace(@Param('id') id: string) {
    return this.adminService.downgradeWorkspace(id);
  }
}
