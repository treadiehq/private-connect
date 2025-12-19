import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('v1/diagnostics')
export class DiagnosticsController {
  constructor(private servicesService: ServicesService) {}

  @Get(':id')
  async getDiagnostic(@Param('id') id: string) {
    const diagnostic = await this.servicesService.getDiagnosticById(id);
    if (!diagnostic) {
      throw new HttpException('Diagnostic not found', HttpStatus.NOT_FOUND);
    }
    return diagnostic;
  }

  @Get('share/:token')
  async getDiagnosticByShareToken(@Param('token') token: string) {
    const diagnostic = await this.servicesService.getDiagnosticByShareToken(token);
    if (!diagnostic) {
      throw new HttpException('Diagnostic not found', HttpStatus.NOT_FOUND);
    }
    return diagnostic;
  }
}

