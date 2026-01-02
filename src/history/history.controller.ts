import {
  Controller,
  Get,
  Delete,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HistoryOwnershipGuard } from './guards/history-ownership.guard';
import * as fs from 'fs';

@Controller('histories')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  // 내 업로드 이력 조회
  @Get()
  async getMyHistories(@Req() req: any) {
    return this.historyService.findAllByUser(req.user.userId);
  }

  // 📌 파일 다운로드
  @Get(':id/download')
  @UseGuards(HistoryOwnershipGuard)
  async downloadFile(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const history = await this.historyService.findOneById(id);

    const fileUrl = history.pdfUrl ?? history.excelUrl;

    if (!fileUrl) {
      throw new NotFoundException('File not found');
    }

    // URL인지 경로인지 확인
    const isUrl = fileUrl.startsWith('http://') || fileUrl.startsWith('https://');

    if (isUrl) {
      // Supabase URL인 경우 리다이렉트
      return res.redirect(302, fileUrl);
    } else {
      // 로컬 파일 경로인 경우
      if (!fs.existsSync(fileUrl)) {
        throw new NotFoundException('File not found');
      }

      const fileName = history.savedFileName;
      const fileExtension = history.pdfUrl ? '.pdf' : '.xlsx';

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}${fileExtension}"`,
      );

      fs.createReadStream(fileUrl).pipe(res);
    }
  }

  // 📌 히스토리 삭제
  @Delete(':id')
  @UseGuards(HistoryOwnershipGuard)
  async deleteHistory(@Param('id') id: string, @Req() req: any) {
    await this.historyService.deleteHistory(id, req.user.userId);
    return { message: 'History deleted successfully' };
  }
}
