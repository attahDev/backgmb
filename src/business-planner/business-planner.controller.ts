import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { BusinessPlannerService } from './business-planner.service';
import { GenerateBusinessPlanDto } from './dto/generate-business-plan.dto';
import { UpdatePlanProgressDto } from './dto/update-plan-progress.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CreditGuard } from 'src/credits/credit.guard';
import { CreditFinalizeInterceptor } from 'src/credits/credit-finalize.interceptor';
import { RequireCredits } from 'src/credits/require-credits.decorator';

@Controller('business-planner')
export class BusinessPlannerController {
  constructor(
    private readonly businessPlannerService: BusinessPlannerService,
  ) {}

  @UseGuards(JwtAuthGuard, CreditGuard)
  @UseInterceptors(CreditFinalizeInterceptor)
  @RequireCredits({
    service: 'business_planner',
    cost: 25,
    minTier: SubscriptionTier.FOUNDER,
  })
  @Post('generate')
  generatePlan(@Req() req: any, @Body() body: GenerateBusinessPlanDto) {
    return this.businessPlannerService.generatePlan(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(@Req() req: any) {
    return this.businessPlannerService.getHistory(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/progress')
  updateProgress(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdatePlanProgressDto,
  ) {
    return this.businessPlannerService.updateProgress(
      req.user.userId,
      id,
      body.completedActionIndexes,
    );
  }

  @Get('health')
  healthCheck() {
    return this.businessPlannerService.healthCheck();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getById(@Req() req: any, @Param('id') id: string) {
    return this.businessPlannerService.getById(req.user.userId, id);
  }
}
