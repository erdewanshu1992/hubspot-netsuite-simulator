import { describe, expect, it } from '@jest/globals';
import validationService from '../src/services/validation.service';
import { DealProperties, LineItemProperties } from '../src/types';

describe('ValidationService', () => {
  describe('validateDealProperties', () => {
    it('should validate a correct deal successfully', () => {
      const validDeal: DealProperties = {
        dealname: 'Test Deal',
        amount: 1000,
        pipeline: 'default',
        dealstage: 'qualifiedtobuy',
        companyId: '123',
        primaryContactId: '456'
      };

      const result = validationService.validateDealProperties(validDeal);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect test deals', () => {
      const testDeal: DealProperties = {
        dealname: 'Test Deal - Demo',
        amount: 1000,
        pipeline: 'default',
        dealstage: 'qualifiedtobuy'
      };

      const result = validationService.validateDealProperties(testDeal);

      expect(result.warnings).toContain('Deal appears to be a test deal based on naming');
    });

    it('should reject deals with invalid stages', () => {
      const invalidDeal: DealProperties = {
        dealname: 'Invalid Deal',
        amount: 1000,
        pipeline: 'default',
        dealstage: 'closedlost'
      };

      const result = validationService.validateDealProperties(invalidDeal);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Deal stage is not valid for processing');
    });

    it('should reject deals with invalid amounts', () => {
      const invalidDeal: DealProperties = {
        dealname: 'Invalid Amount Deal',
        amount: -100,
        pipeline: 'default',
        dealstage: 'qualifiedtobuy'
      };

      const result = validationService.validateDealProperties(invalidDeal);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Deal amount must be a valid positive number');
    });
  });

  describe('validateLineItemProperties', () => {
    it('should validate a correct line item successfully', () => {
      const validLineItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '2',
        price: '50.00',
        hs_sku: 'TEST-001'
      };

      const result = validationService.validateLineItemProperties(validLineItem);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect test/sample SKUs', () => {
      const testLineItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '10.00',
        hs_sku: 'TEST'
      };

      const result = validationService.validateLineItemProperties(testLineItem);

      expect(result.warnings).toContain('Line item appears to be a test/sample SKU');
    });

    it('should reject line items with zero quantity', () => {
      const invalidLineItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '0',
        price: '10.00'
      };

      const result = validationService.validateLineItemProperties(invalidLineItem);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Line item quantity must be a positive number');
    });

    it('should reject line items with negative price', () => {
      const invalidLineItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '-10.00'
      };

      const result = validationService.validateLineItemProperties(invalidLineItem);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Line item price must be a non-negative number');
    });
  });

  describe('isTestDeal', () => {
    it('should identify test deals correctly', () => {
      expect(validationService.isTestDeal('Test Deal')).toBe(true);
      expect(validationService.isTestDeal('Demo Deal')).toBe(true);
      expect(validationService.isTestDeal('Sample Deal')).toBe(true);
      expect(validationService.isTestDeal('Vivacity Test Deal')).toBe(true);
    });

    it('should not identify regular deals as test deals', () => {
      expect(validationService.isTestDeal('Real Customer Deal')).toBe(false);
      expect(validationService.isTestDeal('Enterprise Sale')).toBe(false);
    });
  });

  describe('isInvalidDealStage', () => {
    it('should identify invalid stages correctly', () => {
      expect(validationService.isInvalidDealStage('closedlost')).toBe(true);
      expect(validationService.isInvalidDealStage('7')).toBe(true);
      expect(validationService.isInvalidDealStage('dead')).toBe(true);
    });

    it('should allow valid stages', () => {
      expect(validationService.isInvalidDealStage('qualifiedtobuy')).toBe(false);
      expect(validationService.isInvalidDealStage('presentationscheduled')).toBe(false);
    });
  });

  describe('isValidPipeline', () => {
    it('should validate pipelines correctly', () => {
      expect(validationService.isValidPipeline('default')).toBe(true);
      expect(validationService.isValidPipeline('sales_pipeline')).toBe(true);
      expect(validationService.isValidPipeline('36643521')).toBe(true);
      expect(validationService.isValidPipeline('')).toBe(true); // Empty is allowed
    });

    it('should reject invalid pipelines', () => {
      expect(validationService.isValidPipeline('invalid_pipeline')).toBe(false);
    });
  });

  describe('isPlaceholderItem', () => {
    it('should identify placeholder items correctly', () => {
      const placeholderItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '10.00',
        netsuite_id: '33575'
      };

      expect(validationService.isPlaceholderItem(placeholderItem)).toBe(true);
    });

    it('should identify items without NetSuite ID as placeholders', () => {
      const noNsIdItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '10.00'
      };

      expect(validationService.isPlaceholderItem(noNsIdItem)).toBe(true);
    });

    it('should not identify regular items as placeholders', () => {
      const regularItem: LineItemProperties = {
        hs_object_id: '123',
        quantity: '1',
        price: '10.00',
        netsuite_id: '12345'
      };

      expect(validationService.isPlaceholderItem(regularItem)).toBe(false);
    });
  });

  describe('validateDealForProcessing', () => {
    it('should allow valid deals for processing', () => {
      const validDeal: DealProperties = {
        dealname: 'Valid Deal',
        amount: 1000,
        pipeline: 'default',
        dealstage: 'qualifiedtobuy'
      };

      const associations = {
        lineItems: [{ id: '1', type: 'line_item' }],
        companies: [{ id: '1', type: 'company' }]
      };

      const result = validationService.validateDealForProcessing(validDeal, associations);

      expect(result.canProcess).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject test deals for processing', () => {
      const testDeal: DealProperties = {
        dealname: 'Test Deal',
        amount: 1000,
        pipeline: 'default',
        dealstage: 'qualifiedtobuy'
      };

      const associations = {
        lineItems: [{ id: '1', type: 'line_item' }],
        companies: [{ id: '1', type: 'company' }]
      };

      const result = validationService.validateDealForProcessing(testDeal, associations);

      expect(result.canProcess).toBe(false);
      expect(result.reason).toContain('test deal');
    });

    it('should reject deals without companies', () => {
      const dealWithoutCompany: DealProperties = {
        dealname: 'Deal Without Company',
        amount: 1000,
        pipeline: 'default',
        dealstage: 'qualifiedtobuy'
      };

      const associations = {
        lineItems: [{ id: '1', type: 'line_item' }],
        companies: []
      };

      const result = validationService.validateDealForProcessing(dealWithoutCompany, associations);

      expect(result.canProcess).toBe(false);
      expect(result.reason).toContain('Association validation failed');
    });
  });
});