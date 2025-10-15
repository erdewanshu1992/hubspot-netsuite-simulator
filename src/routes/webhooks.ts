import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';

const router = Router();

// Deal webhooks
router.post('/webhooks/deals/creation', webhookController.handleDealCreation.bind(webhookController));
router.post('/webhooks/deals/property-change', webhookController.handleDealPropertyChange.bind(webhookController));

// Line item webhooks
router.post('/webhooks/line-items/creation', webhookController.handleLineItemCreation.bind(webhookController));
router.post('/webhooks/line-items/property-change', webhookController.handleLineItemPropertyChange.bind(webhookController));

// Quote webhooks
router.post('/webhooks/quotes/published', webhookController.handleQuotePublished.bind(webhookController));

// Legacy route (for backward compatibility)
router.post('/webhooks/hubspot/deal', webhookController.handleDealCreation.bind(webhookController));

export default router;
