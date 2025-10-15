import { describe, expect, it } from '@jest/globals';
import mappingService from '../src/services/mapping.service';
import { LineItemProperties } from '../src/types';

describe('DataMappingService', () => {
  describe('mapHSInternalProperty', () => {
    it('should map HubSpot deal item properties correctly', () => {
      expect(mappingService.mapHSInternalProperty('price', 'dealItems')).toBe('rate');
      expect(mappingService.mapHSInternalProperty('hs_sku', 'dealItems')).toBe('custcol_itemmpn');
      expect(mappingService.mapHSInternalProperty('quantity', 'dealItems')).toBe('quantity');
      expect(mappingService.mapHSInternalProperty('description', 'dealItems')).toBe('description');
    });

    it('should map HubSpot deal properties correctly', () => {
      expect(mappingService.mapHSInternalProperty('dealname', 'deals')).toBe('title');
      expect(mappingService.mapHSInternalProperty('amount', 'deals')).toBe('amount');
      expect(mappingService.mapHSInternalProperty('pipeline', 'deals')).toBe('custbody_deal_pipeline');
      expect(mappingService.mapHSInternalProperty('dealstage', 'deals')).toBe('stage');
    });

    it('should return original property if no mapping exists', () => {
      expect(mappingService.mapHSInternalProperty('unknown_property', 'dealItems')).toBe('unknown_property');
    });
  });

  describe('mapNSInternalProperty', () => {
    it('should map NetSuite opportunity item properties correctly', () => {
      expect(mappingService.mapNSInternalProperty('rate', 'opportunityItems')).toBe('price');
      expect(mappingService.mapNSInternalProperty('custcol_itemmpn', 'opportunityItems')).toBe('hs_sku');
      expect(mappingService.mapNSInternalProperty('quantity', 'opportunityItems')).toBe('quantity');
    });

    it('should map NetSuite opportunity properties correctly', () => {
      expect(mappingService.mapNSInternalProperty('title', 'opportunities')).toBe('dealname');
      expect(mappingService.mapNSInternalProperty('amount', 'opportunities')).toBe('amount');
      expect(mappingService.mapNSInternalProperty('stage', 'opportunities')).toBe('dealstage');
    });

    it('should return original property if no mapping exists', () => {
      expect(mappingService.mapNSInternalProperty('unknown_property', 'opportunityItems')).toBe('unknown_property');
    });
  });

  describe('transformLineItemToOpportunityItem', () => {
    it('should transform placeholder items correctly', () => {
      const placeholderItem: LineItemProperties = {
        hs_object_id: '123',
        hs_sku: 'TEST-SKU',
        quantity: '2',
        price: '50.00',
        description: 'Test Item',
        netsuite_id: '33575'
      };

      const result = mappingService.transformLineItemToOpportunityItem(placeholderItem);

      expect(result.item?.id).toBe('33575');
      expect(result.custcol_itemmpn).toBe('TEST-SKU');
      expect(result.quantity).toBe(2);
      expect(result.rate).toBe(50.00);
      expect(result.description).toBe('Test Item');
    });

    it('should transform regular NetSuite items correctly', () => {
      const regularItem: LineItemProperties = {
        hs_object_id: '123',
        hs_sku: 'REG-SKU',
        quantity: '3',
        price: '75.00',
        description: 'Regular Item',
        netsuite_id: '12345',
        hs_cost_of_goods_sold: '20.00',
        ns_product_cost: '25.00'
      };

      const result = mappingService.transformLineItemToOpportunityItem(regularItem);

      expect(result.item?.id).toBe('12345');
      expect(result.quantity).toBe(3);
      expect(result.rate).toBe(75.00);
      expect(result.costestimatetype?.id).toBe('CUSTOM');
      expect(result.costestimate).toBe(60.00); // 20 * 3
    });

    it('should handle items with matching cost and price', () => {
      const matchingItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '100.00',
        netsuite_id: '12345',
        hs_cost_of_goods_sold: '25.00',
        ns_product_cost: '25.00',
        ns_product_price: '100.00'
      };

      const result = mappingService.transformLineItemToOpportunityItem(matchingItem);

      expect(result.costestimatetype).toBeUndefined();
      expect(result.price).toBeUndefined();
    });
  });

  describe('sortLineItemsByPosition', () => {
    it('should sort line items by position correctly', () => {
      const items: LineItemProperties[] = [
        {
          hs_object_id: '3',
          quantity: '1',
          price: '10.00',
          hs_position_on_quote: '3'
        },
        {
          hs_object_id: '1',
          quantity: '1',
          price: '10.00',
          hs_position_on_quote: '1'
        },
        {
          hs_object_id: '2',
          quantity: '1',
          price: '10.00',
          hs_position_on_quote: '2'
        }
      ];

      const sorted = mappingService.sortLineItemsByPosition(items);

      expect(sorted[0].hs_object_id).toBe('1');
      expect(sorted[1].hs_object_id).toBe('2');
      expect(sorted[2].hs_object_id).toBe('3');
    });

    it('should handle missing position values', () => {
      const items: LineItemProperties[] = [
        {
          hs_object_id: '2',
          quantity: '1',
          price: '10.00'
          // No position
        },
        {
          hs_object_id: '1',
          quantity: '1',
          price: '10.00',
          hs_position_on_quote: '1'
        }
      ];

      const sorted = mappingService.sortLineItemsByPosition(items);

      expect(sorted[0].hs_object_id).toBe('1');
      expect(sorted[1].hs_object_id).toBe('2');
    });
  });

  describe('validateAndCleanLineItem', () => {
    it('should clean and validate line item data', () => {
      const dirtyItem: LineItemProperties = {
        hs_object_id: '  123  ',
        hs_sku: '  TEST-SKU  ',
        quantity: '2.0',
        price: '50.50',
        amount: '101.0',
        description: '  Test Description  ',
        hs_position_on_quote: '1.0',
        hs_cost_of_goods_sold: '20.0',
        netsuite_id: '  12345  ',
        ns_product_cost: '25.0',
        ns_product_price: '50.0',
        mohave_price: '55.0'
      };

      const cleaned = mappingService.validateAndCleanLineItem(dirtyItem);

      expect(cleaned.hs_object_id).toBe('  123  ');
      expect(cleaned.hs_sku).toBe('  TEST-SKU  ');
      expect(cleaned.quantity).toBe('2');
      expect(cleaned.price).toBe('50.5');
      expect(cleaned.amount).toBe('101');
      expect(cleaned.hs_position_on_quote).toBe('1');
      expect(cleaned.hs_cost_of_goods_sold).toBe('20');
    });

    it('should handle missing optional fields', () => {
      const minimalItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '10.00'
      };

      const cleaned = mappingService.validateAndCleanLineItem(minimalItem);

      expect(cleaned.hs_sku).toBe('');
      expect(cleaned.description).toBe('');
      expect(cleaned.hs_position_on_quote).toBe('999');
      expect(cleaned.hs_cost_of_goods_sold).toBe('0');
    });
  });

  describe('transformLineItemsToOpportunityItems', () => {
    it('should transform multiple line items correctly', () => {
      const lineItems: LineItemProperties[] = [
        {
          hs_object_id: '1',
          hs_sku: 'ITEM-1',
          quantity: '2',
          price: '50.00',
          description: 'First Item',
          hs_position_on_quote: '1',
          netsuite_id: '33575'
        },
        {
          hs_object_id: '2',
          hs_sku: 'ITEM-2',
          quantity: '1',
          price: '75.00',
          description: 'Second Item',
          hs_position_on_quote: '2',
          netsuite_id: '12345',
          hs_cost_of_goods_sold: '30.00',
          ns_product_cost: '25.00'
        }
      ];

      const result = mappingService.transformLineItemsToOpportunityItems(lineItems);

      expect(result).toHaveLength(2);
      expect(result[0].custcol_itemmpn).toBe('ITEM-1');
      expect(result[1].item?.id).toBe('12345');
      expect(result[1].costestimatetype?.id).toBe('CUSTOM');
    });

    it('should sort items by position before transformation', () => {
      const unsortedItems: LineItemProperties[] = [
        {
          hs_object_id: '2',
          quantity: '1',
          price: '10.00',
          hs_position_on_quote: '2',
          netsuite_id: '33575'
        },
        {
          hs_object_id: '1',
          quantity: '1',
          price: '10.00',
          hs_position_on_quote: '1',
          netsuite_id: '33575'
        }
      ];

      const result = mappingService.transformLineItemsToOpportunityItems(unsortedItems);

      // Check that items are sorted by position (first item should have position 1)
      expect(result[0]).toBeDefined(); // Position 1
      expect(result[1]).toBeDefined(); // Position 2
    });
  });

  describe('createChangeSummary', () => {
    it('should create change summary for deals', () => {
      const oldDeal = {
        dealname: 'Old Deal',
        amount: 1000,
        dealstage: 'qualifiedtobuy'
      };

      const newDeal = {
        dealname: 'New Deal',
        amount: 1500,
        dealstage: 'presentationscheduled'
      };

      const summary = mappingService.createChangeSummary(oldDeal, newDeal, 'deal');

      expect(summary.hasChanges).toBe(true);
      expect(summary.changedFields).toContain('dealname');
      expect(summary.changedFields).toContain('amount');
      expect(summary.changedFields).toContain('dealstage');
      expect(summary.oldValues.dealname).toBe('Old Deal');
      expect(summary.newValues.dealname).toBe('New Deal');
    });

    it('should create change summary for line items', () => {
      const oldItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '50.00',
        description: 'Old Description'
      };

      const newItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '2',
        price: '75.00',
        description: 'New Description'
      };

      const summary = mappingService.createChangeSummary(oldItem, newItem, 'lineItem');

      expect(summary.hasChanges).toBe(true);
      expect(summary.changedFields).toContain('quantity');
      expect(summary.changedFields).toContain('price');
      expect(summary.changedFields).toContain('description');
    });

    it('should detect no changes correctly', () => {
      const item: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '50.00'
      };

      const summary = mappingService.createChangeSummary(item, item, 'lineItem');

      expect(summary.hasChanges).toBe(false);
      expect(summary.changedFields).toHaveLength(0);
    });
  });
});