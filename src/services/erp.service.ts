import { OpportunityPayload } from '../types';
import { Opportunity } from '../models/Opportunity';

export async function postOpportunity(payload: OpportunityPayload) {
  const updated = await Opportunity.findOneAndUpdate(
    { externalId: payload.externalId },
    { $set: payload },
    { new: true, upsert: true }
  );
  return { created: true, opp: updated.toObject() };
}
