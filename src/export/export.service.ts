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
        doc.on('error', (err) => {
          console.error('PDF 생성 중 에러 발생:', err);
          reject(err);
        });

        // 한글 폰트 등록 (배포 환경 대응)
        let fontRegistered = false;
        const fontPaths = [
          // 배포 환경 (dist 폴더 기준)
          path.join(process.cwd(), 'assets', 'fonts', 'NanumGothic.ttf'),
          path.join(process.cwd(), 'assets', 'fonts', 'NanumGothic-Regular.ttf'),
          // 로컬 개발 환경
          path.join(__dirname, '..', '..', 'assets', 'fonts', 'NanumGothic.ttf'),
          path.join(__dirname, '..', '..', 'assets', 'fonts', 'NanumGothic-Regular.ttf'),
        ];

        for (const fontPath of fontPaths) {
          try {
            const fs = require('fs');
            if (fs.existsSync(fontPath)) {
              doc.registerFont('NanumGothic', fontPath);
              doc.font('NanumGothic');
              fontRegistered = true;
              console.log('✅ 폰트 등록 성공:', fontPath);
              break;
            }
          } catch (fontErr) {
            console.warn('⚠️ 폰트 경로 시도 실패:', fontPath, fontErr.message);
          }
        }

        if (!fontRegistered) {
          console.warn('⚠️ 한글 폰트를 찾을 수 없습니다. 기본 폰트를 사용합니다. (한글이 깨질 수 있음)');
          console.warn('폰트 파일 경로:', fontPaths);
        }

        // 제목
        doc.fontSize(16).text('카카오톡 대화 내역', { align: 'center' });
        doc.moveDown();

        // 메시지가 없는 경우 체크
        if (!messages || messages.length === 0) {
          console.warn('⚠️ 파싱된 메시지가 없습니다.');
          doc.fontSize(12).text('대화 내용이 없습니다.', { align: 'center' });
          doc.end();
          return;
        }

        console.log(`📝 PDF 생성 중: ${messages.length}개의 메시지 처리`);

        // 메시지 출력
        messages.forEach((msg, index) => {
          try {
            doc.fontSize(10).fillColor('gray').text(msg.date || '날짜 없음');
            const messageText = `${msg.sender || '발신자 없음'}: ${msg.message || '메시지 없음'}`;
            doc.fontSize(12).fillColor('black').text(messageText);
            doc.moveDown();
          } catch (msgErr) {
            console.error(`메시지 ${index} 처리 중 에러:`, msgErr);
            console.error('메시지 데이터:', msg);
          }
        });

        doc.end();
      } catch (err) {
        console.error('PDF 생성 실패:', err);
        console.error('에러 스택:', err.stack);
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
