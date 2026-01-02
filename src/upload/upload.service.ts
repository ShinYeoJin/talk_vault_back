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
        doc.on('error', (err) => {
          console.error('PDF 생성 중 에러 발생:', err);
          reject(err);
        });

        // 한글 폰트 등록 (배포 환경 대응)
        let fontRegistered = false;
        const fs = require('fs');
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
  private parseKakaoTalkTxt(content: string) {
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

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 날짜 구분선 확인
      const dateDividerMatch = trimmed.match(dateDividerPattern);
      if (dateDividerMatch) {
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

    return messages;
  }

  /** ================= 파일 처리 ================= */
  async processFile(file: any, userId: string): Promise<History> {
    // 환경 변수 확인
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('🔍 환경 변수 확인:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      supabaseUrlLength: supabaseUrl?.length || 0,
      supabaseKeyLength: supabaseKey?.length || 0,
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
      throw new InternalServerErrorException('서버 설정 오류: Supabase 환경 변수가 없습니다.');
    }

    try {
      console.log('📤 파일 업로드 시작:', {
        fileName: file.originalname,
        fileSize: file.size,
        userId,
        hasBuffer: !!file.buffer,
        bufferSize: file.buffer?.length || 0,
      });

      // 1️⃣ 인코딩 변환 및 TXT 파싱
      let content: string;
      try {
        // iconv-lite를 사용하여 CP949(EUC-KR) → UTF-8 변환 시도
        const iconv = require('iconv-lite');
        if (!file.buffer) {
          throw new Error('파일 버퍼가 없습니다.');
        }
        content = iconv.decode(file.buffer, 'cp949');
        console.log('✅ CP949 인코딩으로 변환 성공');
      } catch (iconvErr) {
        console.warn('⚠️ CP949 변환 실패:', iconvErr.message);
        // CP949 변환 실패 시 UTF-8로 시도
        if (!file.buffer) {
          throw new InternalServerErrorException('파일 버퍼가 없습니다.');
        }
        content = file.buffer.toString('utf-8');
        console.log('⚠️ UTF-8로 변환 시도');
      }

      if (!content || content.length === 0) {
        throw new InternalServerErrorException('파일 내용이 비어있습니다.');
      }

      console.log('📄 파일 내용 샘플 (처음 200자):', content.substring(0, 200));

      // 2️⃣ TXT 파싱
      let messages: any[];
      try {
        messages = this.parseKakaoTalkTxt(content);
        console.log(`✅ 파싱 완료: ${messages.length}개의 메시지 추출`);
      } catch (parseErr) {
        console.error('❌ 파싱 에러:', parseErr);
        throw new InternalServerErrorException(`대화 내용을 파싱하지 못했습니다: ${parseErr.message}`);
      }

      if (!messages || messages.length === 0) {
        throw new InternalServerErrorException('대화 내용을 파싱하지 못했습니다. (메시지가 0개)');
      }

      // 3️⃣ PDF / Excel Buffer 생성
      let pdfBuffer: Buffer;
      let excelBuffer: Buffer;

      try {
        console.log('📝 PDF 생성 시작...');
        pdfBuffer = await this.generatePDF(messages);
        console.log(`✅ PDF 생성 완료: ${pdfBuffer.length} bytes`);
      } catch (pdfErr) {
        console.error('❌ PDF 생성 에러:', pdfErr);
        throw new InternalServerErrorException(`PDF 생성 실패: ${pdfErr.message}`);
      }

      try {
        console.log('📊 Excel 생성 시작...');
        excelBuffer = await this.generateExcel(messages);
        console.log(`✅ Excel 생성 완료: ${excelBuffer.length} bytes`);
      } catch (excelErr) {
        console.error('❌ Excel 생성 에러:', excelErr);
        throw new InternalServerErrorException(`Excel 생성 실패: ${excelErr.message}`);
      }

      // 4️⃣ Supabase 업로드
      const fileId = uuid();
      const pdfPath = `${userId}/${fileId}.pdf`;
      const excelPath = `${userId}/${fileId}.xlsx`;

      try {
        console.log('☁️ Supabase 업로드 시작...');
        console.log('PDF 경로:', pdfPath);
        await this.uploadToSupabase(pdfPath, pdfBuffer, 'application/pdf');
        console.log('✅ PDF 업로드 완료:', pdfPath);
      } catch (pdfUploadErr) {
        console.error('❌ PDF 업로드 에러:', pdfUploadErr);
        throw new InternalServerErrorException(`PDF 업로드 실패: ${pdfUploadErr.message}`);
      }

      try {
        console.log('Excel 경로:', excelPath);
        await this.uploadToSupabase(
          excelPath,
          excelBuffer,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        console.log('✅ Excel 업로드 완료:', excelPath);
      } catch (excelUploadErr) {
        console.error('❌ Excel 업로드 에러:', excelUploadErr);
        throw new InternalServerErrorException(`Excel 업로드 실패: ${excelUploadErr.message}`);
      }

      // 5️⃣ Public URL
      let pdfUrl: string;
      let excelUrl: string;
      try {
        pdfUrl = this.getPublicUrl(pdfPath);
        excelUrl = this.getPublicUrl(excelPath);
        console.log('✅ Public URL 생성 완료');
        console.log('PDF URL:', pdfUrl);
        console.log('Excel URL:', excelUrl);
      } catch (urlErr) {
        console.error('❌ URL 생성 에러:', urlErr);
        throw new InternalServerErrorException(`Public URL 생성 실패: ${urlErr.message}`);
      }

      // 6️⃣ DB 저장
      try {
        const history = this.historyRepository.create({
          originalFileName: file.originalname,
          savedFileName: fileId,
          pdfUrl,
          excelUrl,
          fileSize: file.size,
          userId,
        });

        const savedHistory = await this.historyRepository.save(history);
        console.log('✅ DB 저장 완료:', savedHistory.id);

        return savedHistory;
      } catch (dbErr) {
        console.error('❌ DB 저장 에러:', dbErr);
        throw new InternalServerErrorException(`DB 저장 실패: ${dbErr.message}`);
      }
    } catch (err) {
      console.error('❌ [UPLOAD SERVICE] 전체 에러:', {
        errorType: err.constructor.name,
        message: err.message,
        stack: err.stack?.substring(0, 500), // 스택은 일부만
      });
      
      // 이미 InternalServerErrorException인 경우 그대로 throw
      if (err instanceof InternalServerErrorException) {
        throw err;
      }

      // 알 수 없는 에러인 경우
      throw new InternalServerErrorException(
        `파일 업로드 처리 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`,
      );
    }
  }

  /** ================= SUPABASE ================= */
  private async uploadToSupabase(
    path: string,
    buffer: Buffer,
    contentType: string,
  ) {
    try {
      console.log('📤 Supabase 업로드 시도:', {
        path,
        bufferSize: buffer.length,
        contentType,
      });

      const { data, error } = await this.supabase.storage
        .from('files')
        .upload(path, buffer, { contentType, upsert: false });

      if (error) {
        console.error('❌ SUPABASE UPLOAD ERROR:', {
          message: error.message,
          name: error.name,
          error: JSON.stringify(error),
        });
        throw new Error(`Supabase 업로드 실패: ${error.message}`);
      }

      console.log('✅ Supabase 업로드 성공:', data);
    } catch (err) {
      console.error('❌ Supabase 업로드 예외:', err);
      throw err;
    }
  }

  private getPublicUrl(path: string): string {
    const { data } = this.supabase.storage.from('files').getPublicUrl(path);
    return data.publicUrl;
  }
}
