import {
  Controller,
  Get,
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
    @Res() res: Response,
  ) {
    const history = await this.historyService.findOneById(id);

    const filePath = history.pdfPath ?? history.excelPath;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const fileName = history.savedFileName;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );

    fs.createReadStream(filePath).pipe(res);
  }
}
