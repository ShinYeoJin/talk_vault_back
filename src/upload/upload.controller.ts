import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'), FileUploadInterceptor)
  async uploadFile(
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const userId = req.user.userId;

    const history = await this.uploadService.processFile(file, userId);

    return {
      id: history.id,
      originalFileName: history.originalFileName,
      savedFileName: history.savedFileName,
      pdfPath: history.pdfPath,
      excelPath: history.excelPath,
      fileSize: history.fileSize,
      createdAt: history.createdAt,
    };
  }
}
