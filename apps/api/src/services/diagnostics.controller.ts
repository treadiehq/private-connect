import { Controller, Get, Param, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';

@ApiTags('Diagnostics')
@Controller('v1/diagnostics')
export class DiagnosticsController {
  constructor(private servicesService: ServicesService) {}

  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get diagnostic by ID',
    description:
      'Returns a diagnostic record. Requires workspace auth: `x-api-key` header or session cookie (web UI).',
  })
  @ApiResponse({ status: 200, description: 'Diagnostic details.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Diagnostic belongs to another workspace.' })
  @ApiResponse({ status: 404, description: 'Diagnostic not found.' })
  async getDiagnostic(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const diagnostic = await this.servicesService.getDiagnosticById(id);
    if (!diagnostic) {
      throw new HttpException('Diagnostic not found', HttpStatus.NOT_FOUND);
    }

    // Verify the authenticated workspace owns this diagnostic's service
    const workspace = req.workspace;
    if (diagnostic.service.workspaceId !== workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return diagnostic;
  }

  /**
   * Public endpoint for shared diagnostic access via share token
   * Intentionally returns limited service details only
   */
  @Get('share/:token')
  @ApiOperation({
    summary: 'Get diagnostic by share token',
    description: 'Public read-only access to a diagnostic using the share token (no workspace authentication).',
  })
  @ApiResponse({ status: 200, description: 'Diagnostic details (limited fields for shared view).' })
  @ApiResponse({ status: 404, description: 'Diagnostic not found or share invalid.' })
  async getDiagnosticByShareToken(@Param('token') token: string) {
    const diagnostic = await this.servicesService.getDiagnosticByShareToken(token);
    if (!diagnostic) {
      throw new HttpException('Diagnostic not found', HttpStatus.NOT_FOUND);
    }
    return diagnostic;
  }
}
