import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { History } from '../entities/history.entity';
import { createClient } from '@supabase/supabase-js';
import * as ExcelJS from 'exceljs';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class UploadService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
  ) {}

  /** ================= PDF ================= */
  async generatePDF(messages: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40 });
        const buffers: Buffer[] = [];

        doc.on('data', (d) => buffers.push(d));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // 한글 폰트 적용
        const fontPath = path.join(__dirname, '../../assets/fonts/NanumGothic-Regular.ttf');
        doc.registerFont('NanumGothic', fontPath);
        doc.font('NanumGothic');

        doc.fontSize(16).text('카카오톡 대화 내역', { align: 'center' });
        doc.moveDown();

        messages.forEach((msg) => {
          doc.fontSize(10).fillColor('gray').text(msg.date);
          doc.fontSize(12).fillColor('black').text(`${msg.sender}: ${msg.message}`);
          doc.moveDown();
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /** ================= EXCEL ================= */
  async generateExcel(messages: any[]): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('카카오톡 대화');

      sheet.columns = [
        { header: '날짜', key: 'date', width: 20 },
        { header: '발신자', key: 'sender', width: 15 },
        { header: '메시지', key: 'message', width: 50 },
      ];

      messages.forEach((msg) =>
        sheet.addRow({
          date: msg.date || '',
          sender: msg.sender || '',
          message: msg.message || '',
        }),
      );

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (err) {
      console.error('Excel generation error:', err);
      throw new InternalServerErrorException('Excel 생성 실패');
    }
  }

  /** ================= TXT 파싱 ================= */
  private parseKakaoTalkTxt(content: string) {
    const lines = content.split('\n');
    const messages = [];

    const datePattern =
      /^(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.\s?(오전|오후)\s?(\d{1,2}):(\d{2})/;
    const messagePattern = /^(.+?),\s*(.+)$/;

    let currentDate: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const dateMatch = trimmed.match(datePattern);
      if (dateMatch) {
        const [, y, m, d, ampm, h, min] = dateMatch;
        const hour =
          ampm === '오전'
            ? h === '12'
              ? '00'
              : h.padStart(2, '0')
            : h === '12'
            ? '12'
            : String(Number(h) + 12).padStart(2, '0');

        currentDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${hour}:${min}`;
        continue;
      }

      const msgMatch = trimmed.match(messagePattern);
      if (msgMatch && currentDate) {
        const [, sender, message] = msgMatch;
        messages.push({
          date: currentDate,
          sender: sender.trim(),
          message: message.trim(),
        });
      } else if (currentDate && messages.length > 0) {
        messages[messages.length - 1].message += '\n' + trimmed;
      }
    }

    return messages;
  }

  /** ================= 파일 처리 ================= */
  async processFile(file: any, userId: string): Promise<History> {
    try {
      // 1️⃣ TXT 파싱
      const messages = this.parseKakaoTalkTxt(file.buffer.toString('utf-8'));

      // 2️⃣ PDF / Excel Buffer 생성
      const pdfBuffer = await this.generatePDF(messages);
      const excelBuffer = await this.generateExcel(messages);

      // 3️⃣ Supabase 업로드
      const fileId = uuid();
      const pdfPath = `${userId}/${fileId}.pdf`;
      const excelPath = `${userId}/${fileId}.xlsx`;

      await this.uploadToSupabase(pdfPath, pdfBuffer, 'application/pdf');
      await this.uploadToSupabase(
        excelPath,
        excelBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      // 4️⃣ Public URL
      const pdfUrl = this.getPublicUrl(pdfPath);
      const excelUrl = this.getPublicUrl(excelPath);

      // 5️⃣ DB 저장
      const history = this.historyRepository.create({
        originalFileName: file.originalname,
        savedFileName: fileId,
        pdfUrl,
        excelUrl,
        fileSize: file.size,
        userId,
      });

      return await this.historyRepository.save(history);
    } catch (err) {
      console.error('UPLOAD ERROR:', err);
      console.error(err.stack);
      throw new InternalServerErrorException(
        '파일 업로드 처리 중 오류가 발생했습니다.',
      );
    }
  }

  /** ================= SUPABASE ================= */
  private async uploadToSupabase(
    path: string,
    buffer: Buffer,
    contentType: string,
  ) {
    const { error } = await this.supabase.storage
      .from('files')
      .upload(path, buffer, { contentType, upsert: false });

    if (error) {
      console.error('SUPABASE UPLOAD ERROR:', error);
      throw error;
    }
  }

  private getPublicUrl(path: string): string {
    const { data } = this.supabase.storage.from('files').getPublicUrl(path);
    return data.publicUrl;
  }
}
