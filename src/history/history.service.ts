import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { History } from '../entities/history.entity';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class HistoryService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
  ) {}

  async findAllByUser(userId: string) {
    return this.historyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneById(id: string) {
    const history = await this.historyRepository.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException('History not found');
    }
    return history;
  }

  async validateOwnership(historyId: string, userId: string) {
    const history = await this.findOneById(historyId);
    if (history.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return history;
  }

  async deleteHistory(id: string, userId: string) {
    // 소유권 확인
    const history = await this.validateOwnership(id, userId);

    try {
      // Supabase에서 파일 삭제
      if (history.pdfUrl) {
        const pdfPath = this.extractPathFromUrl(history.pdfUrl);
        if (pdfPath) {
          await this.deleteFromSupabase(pdfPath);
        }
      }

      if (history.excelUrl) {
        const excelPath = this.extractPathFromUrl(history.excelUrl);
        if (excelPath) {
          await this.deleteFromSupabase(excelPath);
        }
      }

      // DB에서 레코드 삭제
      await this.historyRepository.remove(history);
    } catch (err) {
      console.error('DELETE HISTORY ERROR:', err);
      throw new InternalServerErrorException('히스토리 삭제 중 오류가 발생했습니다.');
    }
  }

  /**
   * Supabase URL에서 파일 경로 추출
   * 예: https://xxx.supabase.co/storage/v1/object/public/files/userId/fileId.pdf
   * -> userId/fileId.pdf
   */
  private extractPathFromUrl(url: string): string | null {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // 이미 경로인 경우
      return url;
    }

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const filesIndex = pathParts.indexOf('files');
      
      if (filesIndex !== -1 && filesIndex < pathParts.length - 1) {
        // files 다음 경로들을 합침
        return pathParts.slice(filesIndex + 1).join('/');
      }
    } catch (err) {
      console.error('URL 파싱 오류:', err);
    }

    return null;
  }

  /**
   * Supabase 스토리지에서 파일 삭제
   */
  private async deleteFromSupabase(path: string) {
    const { error } = await this.supabase.storage
      .from('files')
      .remove([path]);

    if (error) {
      console.error('SUPABASE DELETE ERROR:', error);
      // 파일 삭제 실패해도 DB 삭제는 진행 (에러를 throw하지 않음)
    }
  }
}
