import { DealProperties, LineItemProperties, OpportunityItem } from '../types';

/**
 * Data Mapping Service
 * Handles transformations between HubSpot and NetSuite data structures
 */

class DataMappingService {
  /**
   * Maps HubSpot internal property names to NetSuite property names
   */
  mapHSInternalProperty(hsProperty: string, source: string): string {
    const propertyMappings: Record<string, Record<string, string>> = {
      dealItems: {
        'price': 'rate',
        'hs_sku': 'custcol_itemmpn',
        'quantity': 'quantity',
        'amount': 'amount',
        'description': 'description',
        'hs_cost_of_goods_sold': 'costestimate',
        'hs_margin_acv': 'custcol_margin_acv'
      },
      deals: {
        'dealname': 'title',
        'amount': 'amount',
        'pipeline': 'custbody_deal_pipeline',
        'dealstage': 'stage',
        'hs_analytics_source': 'custbody_analytics_source',
        'hs_deal_stage_probability': 'probability'
      }
    };

    return propertyMappings[source]?.[hsProperty] || hsProperty;
  }

  /**
   * Maps NetSuite internal property names to HubSpot property names
   */
  mapNSInternalProperty(nsProperty: string, source: string): string {
    const reversePropertyMappings: Record<string, Record<string, string>> = {
      opportunityItems: {
        'rate': 'price',
        'custcol_itemmpn': 'hs_sku',
        'quantity': 'quantity',
        'amount': 'amount',
        'description': 'description',
        'costestimate': 'hs_cost_of_goods_sold',
        'custcol_margin_acv': 'hs_margin_acv'
      },
      opportunities: {
        'title': 'dealname',
        'amount': 'amount',
        'custbody_deal_pipeline': 'pipeline',
        'stage': 'dealstage',
        'custbody_analytics_source': 'hs_analytics_source',
        'probability': 'hs_deal_stage_probability'
      }
    };

    return reversePropertyMappings[source]?.[nsProperty] || nsProperty;
  }

  /**
   * Transforms HubSpot deal properties to NetSuite opportunity format
   */
  transformDealToOpportunity(hsDeal: DealProperties, companyId: string): any {
    return {
      externalId: hsDeal.hs_object_id,
      title: hsDeal.dealname,
      amount: Number(hsDeal.amount) || 0,
      stage: this.mapDealStageToNetSuite(hsDeal.dealstage),
      customerId: companyId,
      custbody_deal_pipeline: hsDeal.pipeline,
      custbody_analytics_source: hsDeal.hs_analytics_source,
      probability: Number(hsDeal.hs_deal_stage_probability) || 0,
      custbody_hubspot_deal_id: hsDeal.hs_object_id,
      custbody_opportunity_number: hsDeal.opportunity_number
    };
  }

  /**
   * Transforms NetSuite opportunity to HubSpot deal format
   */
  transformOpportunityToDeal(nsOpportunity: any): Partial<DealProperties> {
    return {
      dealname: nsOpportunity.title,
      amount: Number(nsOpportunity.amount) || 0,
      dealstage: this.mapDealStageFromNetSuite(nsOpportunity.stage),
      netsuite_id: nsOpportunity.id,
      opportunity_number: nsOpportunity.custbody_opportunity_number
    };
  }

  /**
   * Transforms HubSpot line item to NetSuite opportunity item format
   */
  transformLineItemToOpportunityItem(hsLineItem: LineItemProperties): OpportunityItem {
    // Handle special case for placeholder item
    if (hsLineItem.netsuite_id === '33575' || !hsLineItem.netsuite_id) {
      return {
        item: { id: '33575' },
        custcol_itemmpn: hsLineItem.hs_sku,
        quantity: parseInt(hsLineItem.quantity) || 0,
        rate: Number(hsLineItem.price) || 0,
        costestimate: this.calculateCostEstimate(hsLineItem.hs_cost_of_goods_sold, hsLineItem.quantity),
        description: hsLineItem.description || `Item: ${hsLineItem.hs_sku || 'Unknown'}`
      };
    } else {
      return this.transformNSItemProperties(hsLineItem);
    }
  }

  /**
   * Transforms NetSuite item properties for existing NetSuite items
   */
  private transformNSItemProperties(item: LineItemProperties): OpportunityItem {
    let opportunityItem: OpportunityItem = {
      item: { id: item.netsuite_id as string },
      quantity: parseInt(item.quantity) || 0,
      rate: Number(item.price) || 0
    };

    // Check if cost estimate needs to be set
    if (item.hs_cost_of_goods_sold !== item.ns_product_cost) {
      opportunityItem.costestimatetype = { id: "CUSTOM" };
      opportunityItem.costestimate = this.calculateCostEstimate(item.hs_cost_of_goods_sold, item.quantity);
    }

    // Check if rate needs to be set
    if (item.price !== item.ns_product_price) {
      opportunityItem.price = { id: "-1" };
    }

    return opportunityItem;
  }

  /**
   * Calculates cost estimate based on cost of goods sold and quantity
   */
  private calculateCostEstimate(cost: string | undefined, quantity: string): number {
    if (!cost) return 0;
    const costValue = Number(cost) || 0;
    const quantityValue = Number(quantity) || 0;
    return Math.round((costValue * quantityValue) * 100) / 100;
  }

  /**
   * Maps HubSpot deal stage to NetSuite opportunity stage
   */
  private mapDealStageToNetSuite(hsStage: string): string {
    const stageMappings: Record<string, string> = {
      'appointmentscheduled': '1', // Qualification
      'qualifiedtobuy': '2',       // Proposal
      'presentationscheduled': '3', // Negotiation
      'decisionmakerboughtin': '4', // Closed Won
      'contractsent': '5',         // Closed Lost
      'closedwon': '6',           // Closed Won
      'closedlost': '7'           // Closed Lost
    };

    return stageMappings[hsStage] || '1'; // Default to Qualification
  }

  /**
   * Maps NetSuite opportunity stage to HubSpot deal stage
   */
  private mapDealStageFromNetSuite(nsStage: string): string {
    const reverseStageMappings: Record<string, string> = {
      '1': 'qualifiedtobuy',      // Qualification -> Qualified to Buy
      '2': 'presentationscheduled', // Proposal -> Presentation Scheduled
      '3': 'decisionmakerboughtin', // Negotiation -> Decision Maker Bought In
      '4': 'closedwon',           // Closed Won
      '5': 'closedlost',          // Closed Lost
      '6': 'closedwon',           // Closed Won
      '7': 'closedlost'           // Closed Lost
    };

    return reverseStageMappings[nsStage] || 'qualifiedtobuy';
  }

  /**
   * Sorts line items by position on quote
   */
  sortLineItemsByPosition(items: LineItemProperties[]): LineItemProperties[] {
    return [...items].sort((a, b) => {
      const positionA = Number(a.hs_position_on_quote) || 999;
      const positionB = Number(b.hs_position_on_quote) || 999;
      return positionA - positionB;
    });
  }

  /**
    * Validates and cleans line item data before transformation
    */
   validateAndCleanLineItem(item: LineItemProperties): LineItemProperties {
     return {
       hs_object_id: item.hs_object_id,
       hs_sku: item.hs_sku || '',
       quantity: String(Number(item.quantity) || 0),
       price: String(Number(item.price) || 0),
       amount: String(Number(item.amount) || 0),
       description: item.description || '',
       hs_position_on_quote: String(Number(item.hs_position_on_quote) || 999),
       hs_cost_of_goods_sold: String(Number(item.hs_cost_of_goods_sold) || 0),
       netsuite_id: item.netsuite_id || '',
       ns_product_cost: item.ns_product_cost || '',
       ns_product_price: item.ns_product_price || '',
       mohave_price: item.mohave_price || '',
       createdAt: item.createdAt,
       updatedAt: item.updatedAt
     };
   }

  /**
   * Transforms multiple line items to opportunity items
   */
  transformLineItemsToOpportunityItems(hsLineItems: LineItemProperties[]): OpportunityItem[] {
    const sortedItems = this.sortLineItemsByPosition(hsLineItems);
    return sortedItems.map(item => this.transformLineItemToOpportunityItem(item));
  }

  /**
    * Creates a summary of changes between old and new data
    */
   createChangeSummary(oldData: any, newData: any, entityType: 'deal' | 'lineItem'): any {
     const changes: any = {
       entityType,
       changedFields: [],
       oldValues: {},
       newValues: {},
       hasChanges: false
     };

     // Compare relevant fields based on entity type
     const fieldsToCompare = entityType === 'deal'
       ? ['dealname', 'amount', 'dealstage', 'pipeline']
       : ['price', 'quantity', 'description', 'hs_sku'];

     fieldsToCompare.forEach(field => {
       if (oldData[field] !== newData[field]) {
         changes.changedFields.push(field);
         changes.oldValues[field] = oldData[field];
         changes.newValues[field] = newData[field];
       }
     });

     changes.hasChanges = changes.changedFields.length > 0;

     return changes;
   }
}

export default new DataMappingService();
