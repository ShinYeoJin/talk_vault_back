import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import iconv from 'iconv-lite';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /** ================= PDF ================= */
  @Post('pdf')
  @UseInterceptors(FileInterceptor('file'))
  async exportPDF(@UploadedFile() file: any, @Res() res: Response) {
    if (!file) throw new BadRequestException('File is required');

    try {
      // 1️⃣ EUC-KR(CP949) → UTF-8 변환
      let content: string;
      try {
        content = iconv.decode(file.buffer, 'cp949');
        console.log('인코딩: CP949로 변환 성공');
      } catch (err) {
        // CP949 변환 실패 시 UTF-8로 시도
        content = file.buffer.toString('utf-8');
        console.log('인코딩: UTF-8로 변환 (CP949 실패)');
      }

      // 디버깅: 파일 내용 샘플 확인
      console.log('파일 크기:', file.buffer.length, 'bytes');
      console.log('파일 내용 샘플 (처음 200자):', content.substring(0, 200));

      // 2️⃣ 메시지 파싱
      const messages = this.exportService.parseKakaoTalkTxt(content);

      // 3️⃣ PDF 생성
      const pdfBuffer = await this.exportService.generatePDF(messages);

      // 4️⃣ 한글 파일명 안전하게 인코딩
      const filename = `${file.originalname.replace(/\.[^/.]+$/, '')}.pdf`;
      const safeFileName = encodeURIComponent(filename);

      // 5️⃣ 응답
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('PDF Export Error:', err);
      throw new BadRequestException('대화 내용을 파싱하지 못했습니다.');
    }
  }

  /** ================= EXCEL ================= */
  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  async exportExcel(@UploadedFile() file: any, @Res() res: Response) {
    if (!file) throw new BadRequestException('File is required');

    try {
      // 1️⃣ EUC-KR(CP949) → UTF-8 변환
      let content: string;
      try {
        content = iconv.decode(file.buffer, 'cp949');
        console.log('인코딩: CP949로 변환 성공');
      } catch (err) {
        // CP949 변환 실패 시 UTF-8로 시도
        content = file.buffer.toString('utf-8');
        console.log('인코딩: UTF-8로 변환 (CP949 실패)');
      }

      // 디버깅: 파일 내용 샘플 확인
      console.log('파일 크기:', file.buffer.length, 'bytes');
      console.log('파일 내용 샘플 (처음 200자):', content.substring(0, 200));

      // 2️⃣ 메시지 파싱
      const messages = this.exportService.parseKakaoTalkTxt(content);

      // 3️⃣ Excel 생성
      const excelBuffer = await this.exportService.generateExcel(messages);

      // 4️⃣ 한글 파일명 안전하게 인코딩
      const filename = `${file.originalname.replace(/\.[^/.]+$/, '')}.xlsx`;
      const safeFileName = encodeURIComponent(filename);

      // 5️⃣ 응답
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}`);
      res.send(excelBuffer);
    } catch (err) {
      console.error('Excel Export Error:', err);
      throw new BadRequestException('대화 내용을 파싱하지 못했습니다.');
    }
  }
}
