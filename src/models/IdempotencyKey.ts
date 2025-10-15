import mongoose from 'mongoose';
const IdemSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    status: { type: String, enum: ['started', 'completed', 'failed'], default: 'started' },
    responseHash: String,
    lastError: String
  },
  { timestamps: true }
);
export const IdempotencyKey = mongoose.model('IdempotencyKey', IdemSchema);
