import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { History } from '../entities/history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([History])],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}

