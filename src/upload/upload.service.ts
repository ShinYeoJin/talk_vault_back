import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { History } from '../entities/history.entity';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

@Injectable()
export class UploadService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly pdfDir = path.join(this.uploadDir, 'pdfs');
  private readonly excelDir = path.join(this.uploadDir, 'excels');

  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
  ) {}

  private async ensureDirectoriesExist() {
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.pdfDir, { recursive: true });
    await fs.mkdir(this.excelDir, { recursive: true });
  }

  async processFile(file: any, userId: string): Promise<History> {
    await this.ensureDirectoriesExist();

    const parsedData = this.parseKakaoTalkTxt(
      file.buffer.toString('utf-8'),
    );

    const savedFileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadDir, savedFileName);

    await fs.writeFile(filePath, file.buffer);

    let pdfPath: string;
    let excelPath: string;

    try {
      pdfPath = await this.generatePDF(parsedData, savedFileName);
      excelPath = await this.generateExcel(parsedData, savedFileName);
    } catch (error) {
      console.error('FILE CONVERSION ERROR:', error);
      throw new InternalServerErrorException(
        '파일 변환 중 오류가 발생했습니다.',
      );
    }

    const history = this.historyRepository.create({
      originalFileName: file.originalname,
      savedFileName,
      filePath,
      pdfPath,
      excelPath,
      fileSize: file.size,
      userId,
    });

    return this.historyRepository.save(history);
  }

  private parseKakaoTalkTxt(content: string) {
    const lines = content.split('\n');
    const messages: {
      date: string;
      sender: string;
      message: string;
    }[] = [];

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

        currentDate = `${y}-${m.padStart(2, '0')}-${d.padStart(
          2,
          '0',
        )} ${hour}:${min}`;
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

  private async generatePDF(messages: any[], baseName: string): Promise<string> {
    const pdfPath = path.join(
      this.pdfDir,
      `${path.parse(baseName).name}.pdf`,
    );

    return new Promise<string>((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const stream = fsSync.createWriteStream(pdfPath);

        doc.pipe(stream);

        doc.fontSize(16).text('카카오톡 대화 내역', { align: 'center' });
        doc.moveDown();

        for (const msg of messages) {
          doc.fontSize(10).fillColor('gray').text(msg.date);
          doc
            .fontSize(12)
            .fillColor('black')
            .text(`${msg.sender}: ${msg.message}`);
          doc.moveDown();
        }

        doc.end();

        stream.on('finish', () => resolve(pdfPath));
        stream.on('error', (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }

  private async generateExcel(
    messages: any[],
    baseName: string,
  ): Promise<string> {
    const excelPath = path.join(
      this.excelDir,
      `${path.parse(baseName).name}.xlsx`,
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('카카오톡 대화');

    worksheet.columns = [
      { header: '날짜', key: 'date', width: 20 },
      { header: '발신자', key: 'sender', width: 15 },
      { header: '메시지', key: 'message', width: 50 },
    ];

    messages.forEach((msg) => worksheet.addRow(msg));

    await workbook.xlsx.writeFile(excelPath);
    return excelPath;
  }
}
