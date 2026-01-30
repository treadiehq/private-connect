import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AskService } from './ask.service';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import { askRateLimiter } from '../common/rate-limiter';
import type { AskRequest, AskResponse } from './ask.types';

@ApiTags('Ask')
@Controller('v1/ask')
export class AskController {
  constructor(private askService: AskService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit('custom', { limiter: askRateLimiter })
  @ApiOperation({
    summary: 'Ask any service',
    description:
      'Public endpoint: send a service URL/hostname and a question. Returns an answer grounded in live GET checks (read-only). No authentication required.',
  })
  @ApiResponse({ status: 200, description: 'Answer and receipts' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async ask(@Body() body: AskRequest): Promise<AskResponse> {
    if (!body || typeof body.service !== 'string' || typeof body.question !== 'string') {
      throw new BadRequestException('service and question are required');
    }
    const question = (body.question || '').trim();
    if (!question) {
      throw new BadRequestException('question is required');
    }
    return this.askService.ask({ service: body.service, question });
  }
}
