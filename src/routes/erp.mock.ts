import { Router } from 'express';
import { Opportunity } from '../models/Opportunity';

const router = Router();

router.post('/erp/opportunities', async (req, res) => {
  const existing = await Opportunity.findOneAndUpdate(
    { externalId: req.body.externalId },
    { $set: req.body },
    { upsert: true, new: true }
  );
  return res.status(201).json({ created: true, opp: existing.toObject() });
});

router.get('/erp/opportunities/:externalId', async (req, res) => {
  const found = await Opportunity.findOne({ externalId: req.params.externalId });
  if (!found) return res.status(404).json({ error: 'not found' });
  return res.json(found.toObject());
});

export default router;
