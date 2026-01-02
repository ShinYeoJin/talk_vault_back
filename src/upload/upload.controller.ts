import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
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
    try {
      if (!file) {
        throw new BadRequestException('File is required');
      }

      console.log('📥 [UPLOAD] 요청 수신:', {
        userId: req.user?.userId,
        fileName: file?.originalname,
        fileSize: file?.size,
        mimetype: file?.mimetype,
        bufferSize: file?.buffer?.length,
      });

      const history = await this.uploadService.processFile(file, req.user.userId);

      const response = {
        id: history.id,
        originalFileName: history.originalFileName,
        savedFileName: history.savedFileName,
        pdfUrl: history.pdfUrl,
        excelUrl: history.excelUrl,
        fileSize: history.fileSize,
        createdAt: history.createdAt,
      };

      console.log('✅ [UPLOAD] 성공:', {
        historyId: history.id,
        pdfUrl: history.pdfUrl ? '있음' : '없음',
        excelUrl: history.excelUrl ? '있음' : '없음',
        responseKeys: Object.keys(response),
      });

      return response;
    } catch (err) {
      console.error('❌ [UPLOAD] Controller 에러:', {
        errorType: err.constructor.name,
        message: err.message,
        stack: err.stack,
        userId: req.user?.userId,
        fileName: file?.originalname,
      });

      // 이미 HttpException인 경우 그대로 throw
      if (err instanceof BadRequestException || err instanceof HttpException) {
        throw err;
      }

      // 알 수 없는 에러인 경우
      throw new BadRequestException(
        `파일 업로드 실패: ${err.message || '알 수 없는 오류'}`,
      );
    }
  }
}
