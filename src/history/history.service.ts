import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { History } from '../entities/history.entity';

@Injectable()
export class HistoryService {
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
}
