import { v4 as uuid } from 'uuid';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger';

export const requestId = (req: any, _res: any, next: any) => {
  req.id = req.headers['x-request-id'] || uuid();
  next();
};

export const httpLogger = pinoHttp({
  logger: logger as any,
  genReqId: (req) => (req.headers['x-request-id'] as string) || uuid()
});
