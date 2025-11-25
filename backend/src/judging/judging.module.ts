import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { JobsModule } from '../jobs/jobs.module';
import { JudgingController } from './judging.controller';
import { JudgingService } from './judging.service';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [SubmissionsModule, EventsModule, JobsModule],
  controllers: [JudgingController],
  providers: [JudgingService],
  exports: [JudgingService],
})
export class JudgingModule {}

