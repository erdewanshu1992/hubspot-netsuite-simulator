import mongoose from 'mongoose';
import { ENV } from './env';

export async function connectDb() {
  await mongoose.connect(ENV.MONGO_URI);
  return mongoose.connection;
}
