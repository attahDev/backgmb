import { Module } from '@nestjs/common';
import { GreenAiController } from './green-ai.controller';
import { GreenAiService } from './green-ai.service';

@Module({
  controllers: [GreenAiController],
  providers: [GreenAiService],
})
export class GreenAiModule {}
