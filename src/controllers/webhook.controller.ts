import { Request, Response } from 'express';
import {
  HubSpotWebhookEvent,
  ExpandedLineItemsHubSpotWebhookEvent,
  DealPropertyCheckResponse,
  CheckLineItemsDealValidityParams,
  GetDealLineItemsOpportunityIdParams,
  DealParseItemsParams
} from '../types';
import dealService from '../services/deal.service';
import lineItemService from '../services/lineItem.service';
import hubspotService from '../services/hubspot.service';
import netsuiteService from '../services/netsuite.service';
import mappingService from '../services/mapping.service';
import validationService from '../services/validation.service';
import redisCacheService from '../services/redisCache.service';
import emailService from '../services/email.service';
import { ENV } from '../config/env';

class WebhookController {
  /**
   * Handles deal creation webhooks
   */
  async handleDealCreation(req: Request, res: Response): Promise<void> {
    try {
      const webhookEvents: HubSpotWebhookEvent[] = Array.isArray(req.body) ? req.body : [req.body];

      console.log(`Processing ${webhookEvents.length} deal creation event(s)`);

      for (const event of webhookEvents) {
        if (event.objectType !== 'deal' || event.subscriptionType !== 'deal.creation') {
          continue;
        }

        try {
          await this.processDealCreation(Number(event.objectId));
        } catch (error) {
          console.error(`Error processing deal creation for deal ${event.objectId}:`, error);
          // Continue processing other events even if one fails
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error in handleDealCreation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handles deal property change webhooks
   */
  async handleDealPropertyChange(req: Request, res: Response): Promise<void> {
    try {
      const webhookEvents: HubSpotWebhookEvent[] = Array.isArray(req.body) ? req.body : [req.body];

      console.log(`Processing ${webhookEvents.length} deal property change event(s)`);

      for (const event of webhookEvents) {
        if (event.objectType !== 'deal' || event.subscriptionType !== 'deal.propertyChange') {
          continue;
        }

        try {
          await this.processDealPropertyChange(
            Number(event.objectId),
            event.propertyName,
            event.propertyValue
          );
        } catch (error) {
          console.error(`Error processing deal property change for deal ${event.objectId}:`, error);
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error in handleDealPropertyChange:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handles line item creation webhooks
   */
  async handleLineItemCreation(req: Request, res: Response): Promise<void> {
    try {
      const expandedItemEvent: ExpandedLineItemsHubSpotWebhookEvent = req.body;

      console.log('Processing line item creation event');

      await this.processLineItemCreation(expandedItemEvent);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error in handleLineItemCreation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handles line item property change webhooks
   */
  async handleLineItemPropertyChange(req: Request, res: Response): Promise<void> {
    try {
      const expandedItemEvent: ExpandedLineItemsHubSpotWebhookEvent = req.body;

      console.log('Processing line item property change event');

      await this.processLineItemPropertyChange(expandedItemEvent);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error in handleLineItemPropertyChange:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handles quote published events
   */
  async handleQuotePublished(req: Request, res: Response): Promise<void> {
    try {
      const { dealId } = req.body;

      if (!dealId) {
        res.status(400).json({ error: 'Deal ID is required' });
        return;
      }

      console.log(`Processing quote published event for deal ${dealId}`);

      await this.processQuotePublished(dealId);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error in handleQuotePublished:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Process deal creation logic
   */
  private async processDealCreation(dealId: number): Promise<void> {
    try {
      // Validate and sync deal to NetSuite
      await dealService.syncDealToNetSuite(String(dealId));
      console.log(`Successfully processed deal creation for deal ${dealId}`);
    } catch (error) {
      console.error(`Failed to process deal creation for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Process deal property change logic
   */
  private async processDealPropertyChange(
    dealId: number,
    propertyName?: string,
    propertyValue?: string
  ): Promise<void> {
    try {
      // Get deal data and validate
      const dealValidation = await dealService.checkDealProperties(String(dealId));

      // Skip if deal shouldn't be processed
      if (dealValidation.isDealTest) {
        console.log(`Skipping test deal ${dealId}`);
        return;
      }

      if (dealValidation.isInvalidStage) {
        console.log(`Skipping deal ${dealId} due to invalid stage`);
        return;
      }

      if (!dealValidation.dealPipelineValid) {
        console.log(`Skipping deal ${dealId} due to invalid pipeline`);
        return;
      }

      // Update opportunity in NetSuite if it exists
      if (dealValidation.netsuiteId) {
        const dealData = await hubspotService.getDeal(String(dealId));
        const dealProperties = dealData.properties;

        const opportunityData = mappingService.transformDealToOpportunity(
          dealProperties,
          dealValidation.dealCompanies[0]?.id || ''
        );

        await netsuiteService.updateOpportunity(dealValidation.netsuiteId, opportunityData);
        console.log(`Updated NetSuite opportunity ${dealValidation.netsuiteId} for deal ${dealId}`);
      }
    } catch (error) {
      console.error(`Failed to process deal property change for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Process line item creation logic
   */
  private async processLineItemCreation(expandedItemEvent: ExpandedLineItemsHubSpotWebhookEvent): Promise<void> {
    const dealId: string = expandedItemEvent.dealId;

    try {
      // Check deal validity
      const validityCheckParams: CheckLineItemsDealValidityParams = {
        dealId,
        event: expandedItemEvent,
        source: 'itemCreate'
      };

      const isDealItemCreationValid: DealPropertyCheckResponse = await this.checkItemDealValidity(validityCheckParams);
      const lineItemProperties = expandedItemEvent.lineItemsData?.lineItemProperties;
      const dealLineItems = isDealItemCreationValid.dealLineItems;
      const dealCompanies = isDealItemCreationValid.dealCompanies;
      let opportunityId: string = isDealItemCreationValid.netsuiteId;

      // Early validation checks
      if (isDealItemCreationValid.dealStageClosed && !isDealItemCreationValid.dealStageClosedWon) {
        console.log("Deal is Closed and not Closed Won, quitting.");
        return;
      }

      if (!isDealItemCreationValid.dealStageClosedWon && !opportunityId) {
        console.log("Deal Item Creation has no Opportunity ID and Deal is not Closed Won, quitting.");
        return;
      }

      if (isDealItemCreationValid.isDealTest) {
        console.log("Deal Item Creation is on a Test Deal, quitting.");
        return;
      }

      if (isDealItemCreationValid.isInvalidStage) {
        console.log("Deal Item Creation Stage is invalid stage, quitting.");
        return;
      }

      if (!isDealItemCreationValid.dealPipelineValid) {
        console.error("Deal Item Creation failed due to invalid Pipeline.");
        return;
      }

      // Check if it's a test company
      const isTestCompany: boolean = this.testCompanyCheck(dealCompanies);
      if (isTestCompany) {
        console.log("Deal Item Creation Company is Test Company, quitting.");
        return;
      }

      // Parse and sync items
      const params: DealParseItemsParams = {
        dealLineItems,
        lineItemProperties,
        dealId: expandedItemEvent.dealId,
        opportunityId,
        dealUpdatedById: isDealItemCreationValid.dealUpdatedById,
        source: 'itemCreate'
      };

      await this.parseItems(params);

    } catch (error) {
      console.error(`Error in processLineItemCreation for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Process line item property change logic
   */
  private async processLineItemPropertyChange(expandedItemEvent: ExpandedLineItemsHubSpotWebhookEvent): Promise<void> {
    const hsValue: string = String(expandedItemEvent.propertyValue);
    const hsProperty: string = String(expandedItemEvent.propertyName);
    const friendlyHSProperty: string = mappingService.mapHSInternalProperty(hsProperty, 'dealItems');
    const friendlyNSProperty: string = mappingService.mapNSInternalProperty(hsProperty, 'opportunityItems');

    const dealId: string = expandedItemEvent.dealId;

    try {
      // Check timestamp equality to avoid duplicate processing
      const timestampEqual = this.timestampEqualityCheck(
        expandedItemEvent.occurredAt,
        expandedItemEvent.lineItemsData.lineItemCreated
      );

      if (timestampEqual) {
        console.log("Timestamps equal, change is part of create event, quitting.");
        return;
      }

      // Check deal validity
      const validityCheckParams: CheckLineItemsDealValidityParams = {
        dealId,
        event: expandedItemEvent,
        friendlyHSProperty,
        friendlyNSProperty,
        hsValue,
        source: 'itemPropChange'
      };

      const isDealItemPropertyChangeValid: DealPropertyCheckResponse = await this.checkItemDealValidity(validityCheckParams);
      const lineItemProperties = expandedItemEvent.lineItemsData?.lineItemProperties;
      const dealLineItems = isDealItemPropertyChangeValid.dealLineItems;
      const dealCompanies = isDealItemPropertyChangeValid.dealCompanies;
      let opportunityId: string = isDealItemPropertyChangeValid.netsuiteId;

      // Early validation checks
      if (isDealItemPropertyChangeValid.dealStageClosed && !isDealItemPropertyChangeValid.dealStageClosedWon) {
        console.log("Deal is Closed and not Closed Won, quitting.");
        return;
      }

      if (!isDealItemPropertyChangeValid.dealStageClosedWon && !opportunityId) {
        console.log("Deal Item Property Change has no Opportunity ID and Deal is not Closed Won, quitting.");
        return;
      }

      if (isDealItemPropertyChangeValid.isDealTest) {
        console.log("Deal Item Property Change is a Test Deal, quitting.");
        return;
      }

      if (isDealItemPropertyChangeValid.isInvalidStage) {
        console.log("Deal Item Property Change Stage is invalid stage, quitting.");
        return;
      }

      if (!isDealItemPropertyChangeValid.dealPipelineValid) {
        console.error("Deal Item Property Change failed due to invalid Pipeline.");
        return;
      }

      // Check if it's a test company
      const isTestCompany: boolean = this.testCompanyCheck(dealCompanies);
      if (isTestCompany) {
        console.log("Deal Item Property Change Company is Test Company, quitting.");
        return;
      }

      // Check cache validity
      if (!isDealItemPropertyChangeValid.cacheValid) {
        console.log("Deal Item Property Change failed due to previous request still existing in cache.");
        return;
      }

      // Handle special cases
      if (hsProperty === 'price') {
        await this.handlePriceChange(dealId, lineItemProperties, hsValue);
        return;
      }

      if (hsProperty === 'hs_margin_acv') {
        await this.handleMarginChange(dealId, lineItemProperties, opportunityId, dealLineItems);
        return;
      }

      // Parse and sync items for other property changes
      const params: DealParseItemsParams = {
        dealLineItems,
        lineItemProperties,
        dealId: expandedItemEvent.dealId,
        opportunityId,
        dealUpdatedById: isDealItemPropertyChangeValid.dealUpdatedById,
        friendlyHSProperty,
        hsValue,
        source: 'itemPropChange'
      };

      await this.parseItems(params);

    } catch (error) {
      console.error(`Error in processLineItemPropertyChange for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Process quote published logic
   */
  private async processQuotePublished(dealId: string): Promise<void> {
    try {
      // Check deal validity
      const validityCheckParams: CheckLineItemsDealValidityParams = {
        dealId,
        source: 'quotePublished'
      };

      const isQuotePublishedDealValid: DealPropertyCheckResponse = await this.checkItemDealValidity(validityCheckParams);
      const dealLineItems = isQuotePublishedDealValid.dealLineItems;
      const dealCompanies = isQuotePublishedDealValid.dealCompanies;
      let opportunityId: string = isQuotePublishedDealValid.netsuiteId;

      // Early validation checks
      if (isQuotePublishedDealValid.dealStageClosed && !isQuotePublishedDealValid.dealStageClosedWon) {
        console.log("Deal is Closed and not Closed Won, quitting.");
        return;
      }

      if (!isQuotePublishedDealValid.dealStageClosedWon && !opportunityId) {
        console.log("Quote Published has no Opportunity ID and Deal is not Closed Won, quitting.");
        return;
      }

      if (isQuotePublishedDealValid.isDealTest) {
        console.log("Quote Published is on a Test Deal, quitting.");
        return;
      }

      if (isQuotePublishedDealValid.isInvalidStage) {
        console.log("Quote Published Stage is invalid stage, quitting.");
        return;
      }

      if (!isQuotePublishedDealValid.dealPipelineValid) {
        console.error("Quote Published failed due to invalid Pipeline.");
        return;
      }

      // Check if it's a test company
      const isTestCompany: boolean = this.testCompanyCheck(dealCompanies);
      if (isTestCompany) {
        console.log("Quote Published Company is Test Company, quitting.");
        return;
      }

      // Check cache validity
      if (!isQuotePublishedDealValid.cacheValid) {
        console.log("Quote Published failed due to previous request still existing in cache.");
        return;
      }

      // Parse and sync items
      const params: DealParseItemsParams = {
        dealLineItems,
        dealId: dealId,
        opportunityId,
        dealUpdatedById: isQuotePublishedDealValid.dealUpdatedById,
        source: 'quotePublished'
      };

      await this.parseItems(params);

    } catch (error) {
      console.error(`Error in processQuotePublished for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Check item deal validity (placeholder implementation)
   */
  private async checkItemDealValidity(params: CheckLineItemsDealValidityParams): Promise<DealPropertyCheckResponse> {
    // This would integrate with the actual deal service validation
    return await dealService.checkDealProperties(params.dealId);
  }

  /**
   * Check if company is a test company
   */
  private testCompanyCheck(dealCompanies: any[]): boolean {
    // Implement test company logic based on your business rules
    return dealCompanies.some(company =>
      company.name?.toLowerCase().includes('test') ||
      company.name?.toLowerCase().includes('vivacity')
    );
  }

  /**
   * Check timestamp equality for duplicate prevention
   */
  private timestampEqualityCheck(occurredAt: number, lineItemCreated: string): boolean {
    // Implement timestamp comparison logic
    return Math.abs(occurredAt - Number(lineItemCreated)) < 1000; // Within 1 second
  }

  /**
   * Handle price change with Mohave logic
   */
  private async handlePriceChange(
    dealId: string,
    lineItemProperties: any,
    hsValue: string
  ): Promise<void> {
    if (lineItemProperties?.mohave_price && lineItemProperties.mohave_price !== '0') {
      // Store Mohave price change event
      await redisCacheService.storeMohavePriceChange(lineItemProperties.hs_object_id);

      if (hsValue === lineItemProperties.mohave_price) {
        console.log("Price matches Mohave price, no action needed");
        return;
      } else {
        await this.processMohavePriceChange(dealId, lineItemProperties.mohave_price, lineItemProperties.hs_object_id);
      }
    }

    console.log("Item Property Change is price. Processing complete.");
  }

  /**
   * Handle margin change with Mohave logic
   */
  private async handleMarginChange(
    dealId: string,
    lineItemProperties: any,
    opportunityId: string,
    dealLineItems: any[]
  ): Promise<void> {
    const mohaveTimestamp = await redisCacheService.checkMohavePriceChange(lineItemProperties.hs_object_id);

    if (mohaveTimestamp) {
      console.log("Margin change is part of Mohave price change, skipping");
      return;
    }

    // Process margin change
    const params: DealParseItemsParams = {
      dealLineItems,
      lineItemProperties,
      dealId,
      opportunityId,
      dealUpdatedById: '', // Would need to get this from validation
      source: 'itemPropChange'
    };

    await this.parseItems(params);
  }

  /**
   * Process Mohave price change
   */
  private async processMohavePriceChange(
    dealId: string,
    mohavePrice: string,
    itemHSId: string
  ): Promise<void> {
    try {
      const data = {
        properties: {
          price: mohavePrice
        }
      };

      await lineItemService.updateLineItemProperties(itemHSId, data);
      console.log(`Reverted price to Mohave price for item ${itemHSId}`);
    } catch (error) {
      console.error(`Error processing Mohave price change for item ${itemHSId}:`, error);
      throw error;
    }
  }

  /**
   * Parse items and sync to NetSuite
   */
  private async parseItems(params: DealParseItemsParams): Promise<void> {
    const { dealLineItems, lineItemProperties, opportunityId, dealId, source } = params;

    if (!opportunityId) {
      console.log(`No opportunity ID for deal ${dealId}, skipping item sync`);
      return;
    }

    console.log(`Parsing items for deal ${dealId}, source: ${source}`);

    try {
      // Get line items data
      const itemsData = await lineItemService.getDealItemsDataForProcessing(
        dealLineItems,
        lineItemProperties,
        source
      );

      if (itemsData.items.length === 0) {
        console.log(`No valid items found for deal ${dealId}`);
        return;
      }

      // Build opportunity items
      const opportunityItems = lineItemService.buildOpportunityItems(itemsData.items);

      if (opportunityItems.length > 0) {
        // Sync to NetSuite
        await netsuiteService.patchOpportunityItems(
          opportunityId,
          { item: { items: opportunityItems } },
          { replace: "item" },
          "?replace=item"
        );

        console.log(`Successfully synced ${opportunityItems.length} items to NetSuite opportunity ${opportunityId}`);
      }

      // Handle failed items
      if (itemsData.failedItems.length > 0) {
        console.warn(`Failed to process ${itemsData.failedItems.length} items for deal ${dealId}`);
        // Could send email notification here
      }

    } catch (error) {
      console.error(`Error parsing items for deal ${dealId}:`, error);
      throw error;
    }
  }
}

export default new WebhookController();