import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsController } from './jobs.controller';
import { PayoutService } from './payout.service';
import { Job, JobSchema } from './schemas/job.schema';
import { EventsModule } from '../events/events.module';

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

