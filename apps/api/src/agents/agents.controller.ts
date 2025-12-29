import { Controller, Post, Body, Get, Param, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { z } from 'zod';

const RegisterSchema = z.object({
  agentId: z.string().uuid(),
  token: z.string().min(32),
  label: z.string().optional(),
  name: z.string().optional(),
});

const HeartbeatSchema = z.object({
  agentId: z.string().uuid(),
  token: z.string().min(32),
});

@Controller('v1/agents')
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post('register')
  @UseGuards(ApiKeyGuard)
  async register(
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    const { agentId, token, label, name } = parsed.data;
    const agent = await this.agentsService.register(workspace.id, agentId, token, label, name);
    
    return { 
      success: true, 
      agent: { 
        id: agent.id, 
        name: agent.name,
        label: agent.label,
        workspaceId: agent.workspaceId,
        createdAt: agent.createdAt,
      } 
    };
  }

  @Post('heartbeat')
  async heartbeat(@Body() body: unknown) {
    const parsed = HeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const { agentId, token } = parsed.data;
    
    const valid = await this.agentsService.validateToken(agentId, token);
    if (!valid) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    await this.agentsService.heartbeat(agentId);
    return { success: true };
  }

  @Get()
  @UseGuards(ApiKeyGuard)
  async findAll(@Req() req: any) {
    const workspace = req.workspace;
    return this.agentsService.findByWorkspace(workspace.id);
  }

  @Get('online')
  @UseGuards(ApiKeyGuard)
  async getOnlineAgents(@Req() req: any) {
    const workspace = req.workspace;
    return this.agentsService.getOnlineAgents(workspace.id);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  async findOne(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const agent = await this.agentsService.findById(id);
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    // Verify agent belongs to requester's workspace
    const workspace = req.workspace;
    if (agent.workspaceId !== workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    return agent;
  }
}
