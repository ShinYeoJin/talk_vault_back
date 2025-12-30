import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './entities/user.entity';
import { History } from './entities/history.entity';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { UploadModule } from './upload/upload.module';
import { HistoryModule } from './history/history.module';
import { TypeOrmConfigService } from './config/typeorm.config';
import { Upload } from './entities/upload.entity';

@Module({
  imports: [
    // 전역 ConfigModule 설정
    ConfigModule.forRoot({
      isGlobal: true,        // 앱 전체에서 process.env 접근 가능
      envFilePath: '.env',   // .env 파일 경로
    }),

    // TypeORM 모듈 설정 (비동기, ConfigService 기반)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: TypeOrmConfigService,
      inject: [ConfigService],  // ConfigService를 주입
    }),

    // 엔티티 단위 등록 (선택적, UserModule에서 별도로 관리 가능)
    TypeOrmModule.forFeature([User, History, Upload]),

    // 다른 모듈
    AuthModule,
    UserModule,
    UploadModule,
    HistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
