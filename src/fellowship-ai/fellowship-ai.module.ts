import { Module } from '@nestjs/common';
import { FellowshipAiController } from './fellowship-ai.controller';
import { FellowshipAiService } from './fellowship-ai.service';

@Module({
  controllers: [FellowshipAiController],
  providers: [FellowshipAiService],
})
export class FellowshipAiModule {}
