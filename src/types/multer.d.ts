import type * as Express from 'express';

declare global {
  namespace Express {
    interface Multer {
      File: Express.Multer.File;
    }

    interface Request {
      file?: Express.Multer.File;
    }
  }
}

export {};