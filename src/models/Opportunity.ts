import mongoose from 'mongoose';
const OpportunitySchema = new mongoose.Schema(
  {
    externalId: { type: String, unique: true, index: true },
    title: String,
    amount: Number,
    pipeline: String,
    stage: String,
    customerId: String,
    items: [
      {
        sku: String,
        quantity: Number,
        rate: Number,
        nsItemId: String
      }
    ]
  },
  { timestamps: true }
);
export const Opportunity = mongoose.model('Opportunity', OpportunitySchema);
