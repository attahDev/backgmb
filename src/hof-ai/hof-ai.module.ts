import { Module } from '@nestjs/common';
import { HofAiController } from './hof-ai.controller';
import { HofAiService } from './hof-ai.service';

@Module({
  controllers: [HofAiController],
  providers: [HofAiService],
})
export class HofAiModule {}
