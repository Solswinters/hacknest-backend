import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Nonce, NonceSchema } from './schemas/nonce.schema';
import { SignatureService } from './signature.service';
import { UsersModule } from '../users/users.module';
import { WalletConnectService } from './walletconnect.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Nonce.name, schema: NonceSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SignatureService, WalletConnectService, JwtStrategy],
  exports: [AuthService, SignatureService, WalletConnectService, JwtStrategy, PassportModule],
})
export class AuthModule {}

