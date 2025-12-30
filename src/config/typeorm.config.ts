import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { History } from '../entities/history.entity';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST') || 'localhost',
      port: parseInt(this.configService.get<string>('DB_PORT') || '5432', 10),
      username: this.configService.get<string>('DB_USER') || 'postgres',
      password: this.configService.get<string>('DB_PASS') || '',
      database: this.configService.get<string>('DB_NAME') || 'talkvault_user',
      entities: [User, History],
      synchronize: true, // 개발 환경에서만 true, 배포 시 false 권장
      logging: false,
    };
  }
}
