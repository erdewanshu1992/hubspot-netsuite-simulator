import { Request, Response } from 'express';
import webhookController from '../src/controllers/webhook.controller';
import { ExpandedLineItemsHubSpotWebhookEvent } from '../src/types';

// Jest globals
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

// Mock the services
jest.mock('../src/services/deal.service');
jest.mock('../src/services/lineItem.service');
jest.mock('../src/services/hubspot.service');
jest.mock('../src/services/netsuite.service');
jest.mock('../src/services/mapping.service');
jest.mock('../src/services/validation.service');
jest.mock('../src/services/redisCache.service');
jest.mock('../src/services/email.service');
jest.mock('../src/services/idempotency.service');

describe('WebhookController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: any;
  let statusSpy: any;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy } as any);

    mockResponse = {
      status: statusSpy as any,
      json: jsonSpy as any
    };

    // Clear all mocks
    jest.clearAllMocks();

    // Setup default mocks for successful test cases
    const mockDealService = require('../src/services/deal.service').default;
    jest.mocked(mockDealService.checkDealProperties).mockResolvedValue({
      isDealTest: false,
      isInvalidStage: false,
      dealStageClosed: false,
      dealStageClosedWon: false,
      dealPipelineValid: true,
      opportunityNumber: 'OPP-001',
      netsuiteId: '12345',
      purchasingContractId: '',
      dealLineItems: [
        {
          id: 'line-item-1',
          name: 'Test Line Item'
        }
      ],
      dealCompanies: [
        {
          id: 'company-1',
          name: 'Test Company'
        }
      ],
      createdAt: '2023-01-01T00:00:00Z',
      dealUpdatedById: 'user-123'
    });

    // Mock HubSpot service
    const mockHubspotService = require('../src/services/hubspot.service').default;
    jest.mocked(mockHubspotService.getDeal).mockResolvedValue({
      properties: {
        hs_object_id: '123',
        dealname: 'Test Deal',
        amount: '1000',
        dealstage: 'qualifiedtobuy',
        pipeline: 'default'
      }
    });
    jest.mocked(mockHubspotService.getDealAssociations).mockResolvedValue({
      lineItems: [
        {
          id: 'line-item-1',
          name: 'Test Line Item'
        }
      ],
      companies: [
        {
          id: 'company-1',
          name: 'Test Company'
        }
      ]
    });
    jest.mocked(mockHubspotService.updateDealProperties).mockResolvedValue(undefined);

    // Mock NetSuite service
    const mockNetsuiteService = require('../src/services/netsuite.service').default;
    jest.mocked(mockNetsuiteService.updateOpportunity).mockResolvedValue(undefined);
    jest.mocked(mockNetsuiteService.patchOpportunityItems).mockResolvedValue(undefined);
    jest.mocked(mockNetsuiteService.syncOpportunityFromDeal).mockResolvedValue('12345');

    // Mock Line Item service
    const mockLineItemService = require('../src/services/lineItem.service').default;
    jest.mocked(mockLineItemService.getDealItemsDataForProcessing).mockResolvedValue({
      items: [
        {
          item: {
            itemid: 'ITEM-001',
            quantity: 1,
            rate: '100.00'
          }
        }
      ],
      failedItems: []
    });
    jest.mocked(mockLineItemService.buildOpportunityItems).mockReturnValue([
      {
        item: {
          itemid: 'ITEM-001',
          quantity: 1,
          rate: '100.00'
        }
      }
    ]);
    jest.mocked(mockLineItemService.updateLineItemProperties).mockResolvedValue(undefined);

    // Mock Redis cache service
    const mockRedisCacheService = require('../src/services/redisCache.service').default;
    jest.mocked(mockRedisCacheService.storeMohavePriceChange).mockResolvedValue(undefined);
    jest.mocked(mockRedisCacheService.checkMohavePriceChange).mockResolvedValue(null);

    // Mock Mapping service
    const mockMappingService = require('../src/services/mapping.service').default;
    jest.mocked(mockMappingService.transformDealToOpportunity).mockReturnValue({
      externalId: '123',
      title: 'Test Deal',
      amount: 1000,
      stage: '1',
      customerId: 'company-1',
      custbody_deal_pipeline: 'default',
      custbody_analytics_source: '',
      probability: 0,
      custbody_hubspot_deal_id: '123',
      custbody_opportunity_number: 'OPP-001'
    });
    jest.mocked(mockMappingService.mapHSInternalProperty).mockReturnValue('price');
    jest.mocked(mockMappingService.mapNSInternalProperty).mockReturnValue('rate');

    // Mock Idempotency service
    const mockIdempotencyService = require('../src/services/idempotency.service').default;
    jest.mocked(mockIdempotencyService.validateIdempotencyKey).mockReturnValue(true);
  });

  describe('handleDealCreation', () => {
    it('should process deal creation webhooks successfully', async () => {
      const requestBody = {
        body: [
          {
            objectId: 123,
            objectType: 'deal',
            subscriptionType: 'deal.creation',
            occurredAt: Date.now()
          }
        ]
      } as Partial<Request>;

      await webhookController.handleDealCreation(requestBody as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });

    it('should handle empty webhook array', async () => {
      const mockRequest = {
        body: []
      } as Partial<Request>;

      await webhookController.handleDealCreation(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });

    it('should handle non-deal events gracefully', async () => {
      const mockRequest = {
        body: [
          {
            objectId: 123,
            objectType: 'contact',
            subscriptionType: 'contact.creation',
            occurredAt: Date.now()
          }
        ]
      } as Partial<Request>;

      await webhookController.handleDealCreation(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });

    it('should handle service errors gracefully', async () => {
      const mockRequest = {
        body: [
          {
            objectId: 123,
            objectType: 'deal',
            subscriptionType: 'deal.creation',
            occurredAt: Date.now()
          }
        ]
      } as Partial<Request>;

      // Mock the deal service properly
      const mockDealService = await import('../src/services/deal.service');
      jest.mocked(mockDealService.default.syncDealToNetSuite).mockRejectedValue(new Error('Service error'));

      await webhookController.handleDealCreation(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200); // Should still return 200 even on error
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('handleDealPropertyChange', () => {
    it('should process deal property change webhooks successfully', async () => {
      const mockRequest = {
        body: [
          {
            objectId: 123,
            objectType: 'deal',
            subscriptionType: 'deal.propertyChange',
            occurredAt: Date.now(),
            propertyName: 'amount',
            propertyValue: '1500'
          }
        ]
      } as Partial<Request>;

      await webhookController.handleDealPropertyChange(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });

    it('should handle single webhook object (not array)', async () => {
      const mockRequest = {
        body: {
          objectId: 123,
          objectType: 'deal',
          subscriptionType: 'deal.propertyChange',
          occurredAt: Date.now(),
          propertyName: 'amount',
          propertyValue: '1500'
        }
      } as Partial<Request>;

      await webhookController.handleDealPropertyChange(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('handleLineItemCreation', () => {
    it('should process line item creation webhooks successfully', async () => {
      const mockEvent: ExpandedLineItemsHubSpotWebhookEvent = {
        objectId: 456,
        objectType: 'line_item',
        subscriptionType: 'line_item.creation',
        occurredAt: Date.now(),
        dealId: '123',
        lineItemsData: {
          lineItemProperties: {
            hs_object_id: '456',
            quantity: '2',
            price: '50.00'
          },
          lineItemCreated: String(Date.now() - 1000)
        }
      };

      const mockRequest = {
        body: mockEvent
      } as Partial<Request>;

      await webhookController.handleLineItemCreation(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });

    it('should handle processing errors gracefully', async () => {
      const mockEvent: ExpandedLineItemsHubSpotWebhookEvent = {
        objectId: 456,
        objectType: 'line_item',
        subscriptionType: 'line_item.creation',
        occurredAt: Date.now(),
        dealId: '123',
        lineItemsData: {
          lineItemProperties: {
            hs_object_id: '456',
            quantity: '2',
            price: '50.00'
          },
          lineItemCreated: String(Date.now() - 1000)
        }
      };

      const mockRequest = {
        body: mockEvent
      } as Partial<Request>;

      // Mock service to throw error
      const mockDealService = await import('../src/services/deal.service');
      jest.mocked(mockDealService.default.checkDealProperties).mockRejectedValue(new Error('Processing error'));

      await webhookController.handleLineItemCreation(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('handleLineItemPropertyChange', () => {
    it('should process line item property change webhooks successfully', async () => {
      const mockEvent: ExpandedLineItemsHubSpotWebhookEvent = {
        objectId: 456,
        objectType: 'line_item',
        subscriptionType: 'line_item.propertyChange',
        occurredAt: Date.now(),
        propertyName: 'price',
        propertyValue: '75.00',
        dealId: '123',
        lineItemsData: {
          lineItemProperties: {
            hs_object_id: '456',
            quantity: '2',
            price: '75.00'
          },
          lineItemCreated: String(Date.now() - 1000)
        }
      };

      const mockRequest = {
        body: mockEvent
      } as Partial<Request>;

      await webhookController.handleLineItemPropertyChange(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('handleQuotePublished', () => {
    it('should process quote published events successfully', async () => {
      const mockRequest = {
        body: {
          dealId: '123'
        }
      } as Partial<Request>;

      await webhookController.handleQuotePublished(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });

    it('should handle missing deal ID', async () => {
      const mockRequest = {
        body: {}
      } as Partial<Request>;

      await webhookController.handleQuotePublished(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Deal ID is required' });
    });

    it('should handle processing errors', async () => {
      const mockRequest = {
        body: {
          dealId: '123'
        }
      } as Partial<Request>;

      // Mock service to throw error
      const mockDealService = await import('../src/services/deal.service');
      jest.mocked(mockDealService.default.checkDealProperties).mockRejectedValue(new Error('Processing error'));

      await webhookController.handleQuotePublished(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple webhook events in a single request', async () => {
      const mockRequest = {
        body: [
          {
            objectId: 123,
            objectType: 'deal',
            subscriptionType: 'deal.creation',
            occurredAt: Date.now()
          },
          {
            objectId: 456,
            objectType: 'deal',
            subscriptionType: 'deal.propertyChange',
            occurredAt: Date.now(),
            propertyName: 'amount',
            propertyValue: '2000'
          }
        ]
      } as Partial<Request>;

      await webhookController.handleDealCreation(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });

    it('should process mixed event types correctly', async () => {
      const mockRequest = {
        body: [
          {
            objectId: 123,
            objectType: 'deal',
            subscriptionType: 'deal.creation',
            occurredAt: Date.now()
          },
          {
            objectId: 456,
            objectType: 'contact', // Non-deal event
            subscriptionType: 'contact.creation',
            occurredAt: Date.now()
          }
        ]
      } as Partial<Request>;

      await webhookController.handleDealCreation(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ received: true });
    });
  });
});