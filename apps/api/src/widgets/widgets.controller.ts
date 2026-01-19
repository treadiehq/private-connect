import { Controller, Get, Param, Query, Res, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { WidgetsService } from './widgets.service';

@ApiTags('Widgets')
@UseGuards(ThrottlerGuard)
@Throttle({ medium: { limit: 60, ttl: 60000 } }) // 60 requests per minute for widgets
@Controller('v1/widgets')
export class WidgetsController {
  constructor(private widgetsService: WidgetsService) {}

  @Get(':shareToken/embed.js')
  @ApiOperation({
    summary: 'Get embeddable JavaScript widget',
    description: 'Returns a JavaScript file that can be embedded in external websites to provide one-click access to a shared service.',
  })
  @ApiResponse({
    status: 200,
    description: 'JavaScript widget code',
    content: { 'application/javascript': {} },
  })
  @ApiResponse({ status: 404, description: 'Share not found or expired' })
  async getEmbedScript(
    @Param('shareToken') shareToken: string,
    @Res() res: Response,
  ) {
    const config = await this.widgetsService.getWidgetConfig(shareToken);
    
    if (!config) {
      throw new HttpException('Share not found or expired', HttpStatus.NOT_FOUND);
    }

    const baseUrl = process.env.WEB_URL || process.env.LINK_BASE_URL || '';
    const script = this.widgetsService.generateEmbedScript(shareToken, baseUrl);

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(script);
  }

  @Get(':shareToken/button')
  @ApiOperation({
    summary: 'Get embeddable button HTML',
    description: 'Returns an HTML page with a styled connect button that can be embedded in an iframe.',
  })
  @ApiQuery({ name: 'text', required: false, description: 'Button text (default: "Connect")' })
  @ApiQuery({ name: 'color', required: false, description: 'Button color (default: "#06b6d4")' })
  @ApiQuery({ name: 'size', required: false, enum: ['small', 'medium', 'large'], description: 'Button size' })
  @ApiResponse({
    status: 200,
    description: 'HTML button',
    content: { 'text/html': {} },
  })
  @ApiResponse({ status: 404, description: 'Share not found or expired' })
  async getEmbedButton(
    @Param('shareToken') shareToken: string,
    @Query('text') text: string,
    @Query('color') color: string,
    @Query('size') size: 'small' | 'medium' | 'large',
    @Res() res: Response,
  ) {
    const config = await this.widgetsService.getWidgetConfig(shareToken);
    
    if (!config) {
      throw new HttpException('Share not found or expired', HttpStatus.NOT_FOUND);
    }

    const baseUrl = process.env.WEB_URL || process.env.LINK_BASE_URL || '';
    const html = this.widgetsService.generateEmbedButton(shareToken, baseUrl, {
      text: text || undefined,
      color: color || undefined,
      size: size || undefined,
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(html);
  }

  @Get(':shareToken/config')
  @ApiOperation({
    summary: 'Get widget configuration',
    description: 'Returns configuration data for building custom widgets.',
  })
  @ApiResponse({
    status: 200,
    description: 'Widget configuration',
    schema: {
      type: 'object',
      properties: {
        shareToken: { type: 'string' },
        serviceName: { type: 'string' },
        serviceType: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        buttonText: { type: 'string' },
        buttonColor: { type: 'string' },
        showServiceInfo: { type: 'boolean' },
        embedUrl: { type: 'string' },
        shareUrl: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Share not found or expired' })
  async getWidgetConfig(@Param('shareToken') shareToken: string) {
    const config = await this.widgetsService.getWidgetConfig(shareToken);
    
    if (!config) {
      throw new HttpException('Share not found or expired', HttpStatus.NOT_FOUND);
    }

    const baseUrl = process.env.WEB_URL || process.env.LINK_BASE_URL || '';
    const apiUrl = process.env.API_URL || '';

    return {
      ...config,
      embedUrl: `${apiUrl}/v1/widgets/${shareToken}/embed.js`,
      shareUrl: `${baseUrl}/share/${shareToken}`,
    };
  }

  @Get(':shareToken/badge')
  @ApiOperation({
    summary: 'Get status badge',
    description: 'Returns an SVG badge showing the share status.',
  })
  @ApiQuery({ name: 'style', required: false, enum: ['flat', 'plastic'], description: 'Badge style' })
  @ApiResponse({
    status: 200,
    description: 'SVG badge',
    content: { 'image/svg+xml': {} },
  })
  async getStatusBadge(
    @Param('shareToken') shareToken: string,
    @Query('style') style: 'flat' | 'plastic',
    @Res() res: Response,
  ) {
    const config = await this.widgetsService.getWidgetConfig(shareToken);
    const isActive = !!config;
    
    const color = isActive ? '#10b981' : '#6b7280';
    const text = isActive ? 'active' : 'inactive';
    const label = config?.serviceName || 'Private Connect';
    
    const labelWidth = label.length * 7 + 10;
    const textWidth = text.length * 7 + 10;
    const totalWidth = labelWidth + textWidth;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${textWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + textWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${text}</text>
    <text x="${labelWidth + textWidth / 2}" y="14">${text}</text>
  </g>
</svg>
`.trim();

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(svg);
  }
}
