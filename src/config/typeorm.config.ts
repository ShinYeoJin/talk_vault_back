import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { History } from '../entities/history.entity';
import { Upload } from '../entities/upload.entity';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: this.configService.get<string>('DATABASE_URL'),
      synchronize: true, // 개발 환경에서는 true, 배포 시 false + migration 권장
      logging: true,
      entities: [User, History, Upload],
      schema: 'talk_vault', // Render DB 내 schema 지정
      autoLoadEntities: true,
      ssl: {
        rejectUnauthorized: false, // Render PostgreSQL 외부 연결용
      },
    };
  }
}
