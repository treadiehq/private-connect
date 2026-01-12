import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';

@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  /**
   * Get admin dashboard stats
   */
  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  /**
   * Get all users with their workspaces
   */
  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  /**
   * Get detailed info about a specific user
   */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  /**
   * Delete a user
   */
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  /**
   * Toggle admin status for a user
   */
  @Post('users/:id/admin')
  async toggleAdmin(
    @Param('id') id: string,
    @Body() body: { isAdmin: boolean },
  ) {
    return this.adminService.toggleAdmin(id, body.isAdmin);
  }

  /**
   * Get all workspaces
   */
  @Get('workspaces')
  async getAllWorkspaces() {
    return this.adminService.getAllWorkspaces();
  }

  /**
   * Get detailed info about a specific workspace
   */
  @Get('workspaces/:id')
  async getWorkspace(@Param('id') id: string) {
    return this.adminService.getWorkspace(id);
  }

  /**
   * Upgrade a workspace to PRO
   */
  @Post('workspaces/:id/upgrade')
  async upgradeWorkspace(@Param('id') id: string) {
    return this.adminService.upgradeWorkspace(id);
  }

  /**
   * Downgrade a workspace to FREE
   */
  @Post('workspaces/:id/downgrade')
  async downgradeWorkspace(@Param('id') id: string) {
    return this.adminService.downgradeWorkspace(id);
  }
}
