import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type LogDocument = Log & Document;

@Schema({ collection: 'base_logs', timestamps: true })
export class Log {
  @Prop({ required: true, index: true })
  logId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  timestamp: number;

  @Prop({ required: true, index: true })
  logName: string;

  @Prop({ type: SchemaTypes.Mixed })
  payload: any;
}

export const LogSchema = SchemaFactory.createForClass(Log);
