import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { HistoryService } from '../history.service';

@Injectable()
export class HistoryOwnershipGuard implements CanActivate {
  constructor(private readonly historyService: HistoryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.userId;
    const historyId = request.params.id;

    await this.historyService.validateOwnership(historyId, userId);
    return true;
  }
}
