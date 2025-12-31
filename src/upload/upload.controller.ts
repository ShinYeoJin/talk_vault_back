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
     /**
     * 🔍 프론트 요청 대응용 로그
     * - Render Logs에서 file 메타 확인 가능
     */
     console.log('UPLOAD FILE META:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
    });

    if (!file) {
      console.error('UPLOAD ERROR: file is undefined');
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
