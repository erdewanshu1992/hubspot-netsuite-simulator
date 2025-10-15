import {
  DealLineItem,
  LineItemProperties,
  OpportunityItem,
  DealAssociationData,
  FailedLineItems,
  GetDealLineItemsData
} from '../types';
import hubspotService from './hubspot.service';
import mappingService from './mapping.service';

class LineItemService {
  /**
   * Gets comprehensive line item data for processing
   */
  async getDealItemsData(itemId: string): Promise<DealLineItem> {
    return await hubspotService.getDealItemsData(itemId);
  }

  /**
   * Gets multiple line items data for a deal
   */
  async getMultipleDealItemsData(itemIds: string[]): Promise<DealLineItem[]> {
    return await hubspotService.getMultipleLineItems(itemIds);
  }

  /**
   * Gets line item data with associated deal information
   */
  async getLineItemData(itemHSId: string): Promise<GetDealLineItemsData> {
    try {
      const lineItemData: DealLineItem = await this.getDealItemsData(itemHSId);
      const lineItemAssociatedDealId: string = lineItemData.associations?.deals?.results[0]?.id || "";
      const lineItemCreated: string = lineItemData.createdAt;
      const lineItemProperties: LineItemProperties = lineItemData.properties;

      return {
        lineItemAssociatedDealId,
        lineItemCreated,
        lineItemProperties
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        console.error(`Deal Item ${itemHSId} not found.`);
        return {
          lineItemAssociatedDealId: "",
          lineItemCreated: "",
          lineItemProperties: {} as LineItemProperties
        };
      } else {
        throw error;
      }
    }
  }

  /**
   * Checks if error is a "Not Found" error
   */
  private isNotFoundError(error: any): boolean {
    return error.message && error.message.includes("Not Found");
  }

  /**
   * Gets all line items for a deal
   */
  async getDealLineItems(dealId: string): Promise<DealAssociationData[]> {
    return await hubspotService.getDealLineItems(dealId);
  }

  /**
   * Gets detailed line items data for processing
   */
  async getDealItemsDataForProcessing(
    dealLineItems: DealAssociationData[],
    lineItemProperties?: LineItemProperties,
    source: string = 'unknown'
  ): Promise<{
    items: LineItemProperties[];
    failedItems: FailedLineItems[];
  }> {
    let items: LineItemProperties[] = [];
    let failedItems: FailedLineItems[] = [];

    // If we have specific line item properties (from webhook), add them first
    if (lineItemProperties && source !== 'quotePublished') {
      const cleanedItem = mappingService.validateAndCleanLineItem(lineItemProperties);
      items.push(cleanedItem);
    }

    // Get data for remaining items
    const remainingItems = dealLineItems.filter(item =>
      !lineItemProperties || item.id !== lineItemProperties.hs_object_id
    );

    for (const item of remainingItems) {
      try {
        const itemData: DealLineItem = await this.getDealItemsData(item.id);
        const cleanedItem = mappingService.validateAndCleanLineItem(itemData.properties);
        items.push(cleanedItem);
      } catch (error) {
        if (this.isNotFoundError(error)) {
          console.log(`Line item ${item.id} not found, skipping`);
          continue;
        }
        failedItems.push({
          itemHSId: item.id,
          error: (error as Error).message || String(error)
        });
      }
    }

    return { items, failedItems };
  }

  /**
   * Builds opportunity items from HubSpot line items
   */
  buildOpportunityItems(itemsData: LineItemProperties[]): OpportunityItem[] {
    return mappingService.transformLineItemsToOpportunityItems(itemsData);
  }

  /**
   * Validates line item data before processing
   */
  validateLineItemForProcessing(lineItem: LineItemProperties): {
    isValid: boolean;
    reason?: string;
  } {
    // Check required fields
    if (!lineItem.hs_object_id) {
      return { isValid: false, reason: 'Missing HubSpot object ID' };
    }

    if (!lineItem.quantity || Number(lineItem.quantity) <= 0) {
      return { isValid: false, reason: 'Invalid or missing quantity' };
    }

    if (!lineItem.price || Number(lineItem.price) < 0) {
      return { isValid: false, reason: 'Invalid or missing price' };
    }

    // Check if it's a test/SKU item that should be skipped
    if (lineItem.hs_sku === 'TEST' || lineItem.hs_sku === 'SAMPLE') {
      return { isValid: false, reason: 'Test/Sample SKU detected' };
    }

    return { isValid: true };
  }

  /**
   * Processes line items for NetSuite synchronization
   */
  async processLineItemsForSync(
    dealId: string,
    lineItems: LineItemProperties[],
    opportunityId: string
  ): Promise<{
    opportunityItems: OpportunityItem[];
    failedItems: FailedLineItems[];
    skippedItems: string[];
  }> {
    const opportunityItems: OpportunityItem[] = [];
    const failedItems: FailedLineItems[] = [];
    const skippedItems: string[] = [];

    for (const item of lineItems) {
      // Validate line item
      const validation = this.validateLineItemForProcessing(item);
      if (!validation.isValid) {
        if (validation.reason?.includes('Test/Sample')) {
          skippedItems.push(item.hs_object_id);
          console.log(`Skipping test/sample item ${item.hs_object_id}: ${validation.reason}`);
        } else {
          failedItems.push({
            itemHSId: item.hs_object_id,
            error: validation.reason || 'Validation failed'
          });
        }
        continue;
      }

      try {
        // Transform to opportunity item
        const opportunityItem = mappingService.transformLineItemToOpportunityItem(item);
        opportunityItems.push(opportunityItem);
      } catch (error) {
        failedItems.push({
          itemHSId: item.hs_object_id,
          error: (error as Error).message || String(error)
        });
      }
    }

    return {
      opportunityItems,
      failedItems,
      skippedItems
    };
  }

  /**
   * Updates line item properties in HubSpot
   */
  async updateLineItemProperties(
    itemId: string,
    properties: Record<string, any>
  ): Promise<void> {
    try {
      await hubspotService.updateDealProperties(itemId, properties);
    } catch (error) {
      throw new Error(`Failed to update line item ${itemId}: ${error}`);
    }
  }

  /**
   * Creates a summary of line item processing results
   */
  createProcessingSummary(
    totalItems: number,
    processedItems: number,
    failedItems: FailedLineItems[],
    skippedItems: string[]
  ): string {
    let summary = `Line Item Processing Summary:\n`;
    summary += `Total Items: ${totalItems}\n`;
    summary += `Successfully Processed: ${processedItems}\n`;
    summary += `Failed Items: ${failedItems.length}\n`;
    summary += `Skipped Items: ${skippedItems.length}\n`;

    if (failedItems.length > 0) {
      summary += `\nFailed Items Details:\n`;
      failedItems.forEach(item => {
        summary += `- Item ${item.itemHSId}: ${item.error}\n`;
      });
    }

    if (skippedItems.length > 0) {
      summary += `\nSkipped Items: ${skippedItems.join(', ')}\n`;
    }

    return summary;
  }

  /**
   * Filters line items based on processing criteria
   */
  filterLineItemsForProcessing(
    lineItems: LineItemProperties[],
    source: string
  ): LineItemProperties[] {
    return lineItems.filter(item => {
      // Skip items without NetSuite ID for certain operations
      if (source === 'itemCreate' && !item.netsuite_id) {
        return false;
      }

      // Skip items with zero quantity or price
      if (Number(item.quantity) <= 0 || Number(item.price) < 0) {
        return false;
      }

      return true;
    });
  }

  /**
   * Gets line item change details for comparison
   */
  getLineItemChangeDetails(
    oldItem: LineItemProperties,
    newItem: LineItemProperties
  ): {
    hasChanges: boolean;
    changedFields: string[];
    changes: Record<string, { from: any; to: any }>;
  } {
    const changedFields: string[] = [];
    const changes: Record<string, { from: any; to: any }> = {};

    const fieldsToCompare = [
      'quantity', 'price', 'description', 'hs_sku',
      'hs_cost_of_goods_sold', 'hs_position_on_quote'
    ];

    fieldsToCompare.forEach(field => {
      if (oldItem[field] !== newItem[field]) {
        changedFields.push(field);
        changes[field] = {
          from: oldItem[field],
          to: newItem[field]
        };
      }
    });

    return {
      hasChanges: changedFields.length > 0,
      changedFields,
      changes
    };
  }
}

export default new LineItemService();