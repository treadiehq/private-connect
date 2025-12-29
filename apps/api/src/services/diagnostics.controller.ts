import { Controller, Get, Param, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Controller('v1/diagnostics')
export class DiagnosticsController {
  constructor(private servicesService: ServicesService) {}

  @Get(':id')
  @UseGuards(ApiKeyGuard)
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
  async getDiagnosticByShareToken(@Param('token') token: string) {
    const diagnostic = await this.servicesService.getDiagnosticByShareToken(token);
    if (!diagnostic) {
      throw new HttpException('Diagnostic not found', HttpStatus.NOT_FOUND);
    }
    return diagnostic;
  }
}
