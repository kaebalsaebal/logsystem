/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { LogDTO } from './dto/log.dto';
import { Log, LogDocument } from './mongo/log.schema';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  private readonly redisClient: Redis;
  private readonly REDIS_QUEUE_KEY = 'msw_logs';

  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {
    this.redisClient = new Redis({
      host: '172.30.1.201',
      port: 6379,
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis 서버에 연결되었습니다');
    });
    this.redisClient.on('error', (e) => {
      this.logger.error('Redis 연결 에라:', e);
    });
  }

  async ReceiveLogs(logs: LogDTO[]) {
    if (!logs || logs.length === 0) {
      return { status: 'failed', message: 'No logs received' };
    }

    try {
      const pipeline = this.redisClient.pipeline();
      logs.forEach((log) => {
        pipeline.rpush(this.REDIS_QUEUE_KEY, JSON.stringify(log));
      });
      await pipeline.exec();

      this.logger.log(`Redis에 로그 ${logs.length}개 적재 완료`);
      return { status: 'queued', message: `${logs.length} logs queued` };
    } catch (e) {
      this.logger.error('Redis 적재 실패', e);
      return { status: 'failed', message: 'Queueing failed' };
    }
  }

  @Cron('*/60 * * * * *')
  async InserToMongo() {
    let redisLogs: string[] = [];

    try {
      redisLogs = await this.redisClient.lrange(this.REDIS_QUEUE_KEY, 0, -1);

      if (redisLogs.length === 0) return;

      await this.redisClient.ltrim(this.REDIS_QUEUE_KEY, redisLogs.length, -1);

      const logsToInsert: LogDTO[] = redisLogs.map(
        (log) => JSON.parse(log) as LogDTO,
      );

      this.logger.log(
        `Redis에서 MongoDB로 로그 ${logsToInsert.length}개 이관 중...`,
      );

      await this.logModel.insertMany(logsToInsert);

      this.logger.log(
        `MongoDB에 로그 ${logsToInsert.length}개 적재 완료했습니다냥 🐾`,
      );
    } catch (e) {
      this.logger.error(`MongoDB 적재 실패. 다시 Redis로 복구합니다...`, e);

      if (redisLogs.length > 0) {
        try {
          const pipeline = this.redisClient.pipeline();

          redisLogs.reverse().forEach((logStr) => {
            pipeline.lpush(this.REDIS_QUEUE_KEY, logStr);
          });

          await pipeline.exec();
          this.logger.log(`${redisLogs.length}개의 로그를 Redis로 복구했니다.`);
        } catch (e) {
          this.logger.fatal(
            `Redis 복구 실패! 유실된 데이타들을 확인해 주세요`,
            e,
          );
        }
      }
    }
  }

  async GetMonsterHuntingStats(mobNm?: string) {
    this.logger.log('몬스터 처치 데이타를 집계 또는 몬스터별로 조회합니다...');

    const baseQuery: Record<string, any> = { logName: 'MONSTER_DEAD' };
    if (mobNm) {
      baseQuery['payload.mobNm'] = mobNm;
    }

    interface MonsterHuntingStat {
      _id: string;
      killCount: number;
    }

    const mongoData = await this.logModel.aggregate<MonsterHuntingStat>([
      { $match: baseQuery },
      {
        $group: {
          _id: '$payload.mobNm',
          killCount: { $sum: 1 },
        },
      },
      { $sort: { killCount: -1 } },
    ]);

    const returnData = mongoData.map((data) => ({
      mobNm: data._id,
      killCount: data.killCount,
    }));

    const totalCount = returnData.reduce(
      (sum, item) => sum + item.killCount,
      0,
    );

    return { totalKillCount: totalCount, returnData };
  }

  async GetGainedItemStatsByUser(userId?: string) {
    this.logger.log(
      '사용자별 아이템 습득 데이타를 집계 또는 사용자별로 조회합니다...',
    );

    const baseQuery: Record<string, any> = { logName: 'PLAYER_GETITEM' };
    if (userId) {
      baseQuery['payload.getUsrId'] = userId;
    }

    interface GainedItemStat {
      _id: {
        getUsrId: string;
        itemNm: string;
      };
      itemCount: number;
    }

    const mongoData = await this.logModel.aggregate<GainedItemStat>([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            getUsrId: '$payload.getUsrId',
            itemNm: '$payload.itemNm',
          },
          itemCount: { $sum: 1 },
        },
      },
      { $sort: { itemCount: -1 } },
    ]);

    const returnData = mongoData.map((data) => ({
      userId: data._id.getUsrId,
      itemNm: data._id.itemNm,
      itemCount: data.itemCount,
    }));

    const totalCount = returnData.reduce(
      (sum, item) => sum + item.itemCount,
      0,
    );

    return { totalItemCount: totalCount, returnData };
  }
}
