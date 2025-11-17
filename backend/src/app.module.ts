import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { JudgingModule } from './judging/judging.module';
import { Web3Module } from './web3/web3.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthController } from './common/controllers/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    EventsModule,
    SubmissionsModule,
    JudgingModule,
    Web3Module,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

