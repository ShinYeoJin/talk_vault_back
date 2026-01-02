import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    console.log('REQ USER:', req.user);
    console.log('UPLOAD FILE META:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
    });

    const history = await this.uploadService.processFile(file, req.user.userId);

    return {
      id: history.id,
      originalFileName: history.originalFileName,
      savedFileName: history.savedFileName,
      pdfUrl: history.pdfUrl,
      excelUrl: history.excelUrl,
      fileSize: history.fileSize,
      createdAt: history.createdAt,
    };
  }
}
