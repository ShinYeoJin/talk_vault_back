import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExportService {
  /** ================= PDF ================= */
  async generatePDF(messages: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40 });
        const buffers: Buffer[] = [];

        doc.on('data', (d) => buffers.push(d));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // 한글 폰트 등록
        const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'NanumGothic.ttf');
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
  public parseKakaoTalkTxt(content: string): any[] {
    const lines = content.split(/\r?\n/);
    const messages: { date: string; sender: string; message: string }[] = [];

    // 날짜 구분선 패턴: "--------------- 2025년 12월 29일 월요일 ---------------"
    const dateDividerPattern = /^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;

    // 메시지 패턴: "[이름] [오전/오후 시간:분] 메시지"
    // 예: "[IT 신여진님] [오전 11:32] ."
    const messagePattern = /^\[(.+?)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.+)$/;

    let currentDate: string | null = null;
    let currentYear: string | null = null;
    let currentMonth: string | null = null;
    let currentDay: string | null = null;
    let parsedLines = 0;
    let dateLines = 0;
    let messageLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      parsedLines++;

      // 날짜 구분선 확인
      const dateDividerMatch = trimmed.match(dateDividerPattern);
      if (dateDividerMatch) {
        dateLines++;
        const [, y, m, d] = dateDividerMatch;
        currentYear = y;
        currentMonth = m.padStart(2, '0');
        currentDay = d.padStart(2, '0');
        currentDate = `${y}-${currentMonth}-${currentDay}`;
        continue;
      }

      // 메시지 라인 확인: [이름] [오전/오후 시간:분] 메시지
      const msgMatch = trimmed.match(messagePattern);
      if (msgMatch && currentDate) {
        const [, sender, ampm, h, min, message] = msgMatch;
        messageLines++;

        // 시간 변환
        const hour =
          ampm === '오전'
            ? h === '12'
              ? '00'
              : h.padStart(2, '0')
            : h === '12'
            ? '12'
            : String(Number(h) + 12).padStart(2, '0');

        const fullDateTime = `${currentDate} ${hour}:${min}`;

        messages.push({
          date: fullDateTime,
          sender: sender.trim(),
          message: message.trim(),
        });
      } else if (messages.length > 0 && currentDate) {
        // 이전 메시지에 이어서 붙이기 (여러 줄 메시지)
        // 단, 새로운 메시지 패턴이 아닌 경우에만
        if (!trimmed.match(/^\[.+\]\s*\[(오전|오후)/)) {
          messages[messages.length - 1].message += '\n' + trimmed;
        }
      }
    }

    // 디버깅 정보 출력
    console.log('파싱 결과:', {
      총_라인수: parsedLines,
      날짜_라인수: dateLines,
      메시지_라인수: messageLines,
      파싱된_메시지수: messages.length,
      첫_10줄: lines.slice(0, 10).map((l, i) => `${i + 1}: ${l.substring(0, 50)}`),
    });

    if (messages.length === 0) {
      // 더 자세한 에러 메시지
      const errorMsg = `대화 내용을 파싱하지 못했습니다. (총 ${parsedLines}줄, 날짜 구분선 ${dateLines}개 발견)`;
      console.error('파싱 실패 - 파일 내용 샘플:', content.substring(0, 500));
      throw new InternalServerErrorException(errorMsg);
    }

    return messages;
  }
}
