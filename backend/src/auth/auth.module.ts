import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SignatureService } from './signature.service';
import { WalletConnectService } from './walletconnect.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Nonce, NonceSchema } from './schemas/nonce.schema';
import { UsersModule } from '../users/users.module';

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

