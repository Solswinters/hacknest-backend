import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../events/events.module';
import { Job, JobSchema } from './schemas/job.schema';
import { JobsController } from './jobs.controller';
import { PayoutService } from './payout.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    EventsModule,
  ],
  controllers: [JobsController],
  providers: [PayoutService],
  exports: [PayoutService],
})
export class JobsModule {}

