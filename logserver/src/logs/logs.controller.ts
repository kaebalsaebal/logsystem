import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogDTO } from './dto/log.dto';

@Controller('api/v1')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post('logs')
  ReceiveLogs(@Body() logs: LogDTO[]) {
    return this.logsService.ReceiveLogs(logs);
  }

  @Get('stats/mobhunt')
  GetHuntingStats(@Query('mobNm') mobNm?: string) {
    return this.logsService.GetMonsterHuntingStats(mobNm);
  }

  @Get('stats/itemgain')
  GetGainedItemStatsByUser(@Query('userId') userId?: string) {
    return this.logsService.GetGainedItemStatsByUser(userId);
  }
}
