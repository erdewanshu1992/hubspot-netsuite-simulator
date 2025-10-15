import {
  DealProperties,
  LineItemProperties,
  DealAssociationData,
  ExpandedLineItemsHubSpotWebhookEvent
} from '../types';

class ValidationService {
  /**
   * Validates deal properties for required fields and business rules
   */
  validateDealProperties(dealProperties: DealProperties): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validations
    if (!dealProperties.dealname || dealProperties.dealname.trim() === '') {
      errors.push('Deal name is required');
    }

    if (!dealProperties.dealstage || dealProperties.dealstage.trim() === '') {
      errors.push('Deal stage is required');
    }

    if (!dealProperties.pipeline || dealProperties.pipeline.trim() === '') {
      warnings.push('Deal pipeline is not set');
    }

    // Numeric field validations
    const amount = Number(dealProperties.amount);
    if (isNaN(amount) || amount < 0) {
      errors.push('Deal amount must be a valid positive number');
    }

    // Business rule validations
    if (this.isTestDeal(dealProperties.dealname)) {
      warnings.push('Deal appears to be a test deal based on naming');
    }

    if (this.isInvalidDealStage(dealProperties.dealstage)) {
      errors.push('Deal stage is not valid for processing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates line item properties for required fields and business rules
   */
  validateLineItemProperties(lineItem: LineItemProperties): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validations
    if (!lineItem.hs_object_id || lineItem.hs_object_id.trim() === '') {
      errors.push('Line item HubSpot ID is required');
    }

    if (!lineItem.quantity || lineItem.quantity.trim() === '') {
      errors.push('Line item quantity is required');
    }

    if (!lineItem.price || lineItem.price.trim() === '') {
      errors.push('Line item price is required');
    }

    // Numeric field validations
    const quantity = Number(lineItem.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('Line item quantity must be a positive number');
    }

    const price = Number(lineItem.price);
    if (isNaN(price) || price < 0) {
      errors.push('Line item price must be a non-negative number');
    }

    // Business rule validations
    if (lineItem.hs_sku === 'TEST' || lineItem.hs_sku === 'SAMPLE') {
      warnings.push('Line item appears to be a test/sample SKU');
    }

    if (this.isPlaceholderItem(lineItem)) {
      warnings.push('Line item appears to be a placeholder item');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates webhook event data integrity
   */
  validateWebhookEvent(event: ExpandedLineItemsHubSpotWebhookEvent): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!event.objectId) {
      errors.push('Webhook event missing object ID');
    }

    if (!event.occurredAt || event.occurredAt <= 0) {
      errors.push('Webhook event missing or invalid timestamp');
    }

    if (!event.subscriptionType) {
      errors.push('Webhook event missing subscription type');
    }

    if (event.subscriptionType?.includes('line_item') && !event.lineItemsData) {
      errors.push('Line item webhook event missing line items data');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates deal associations for required relationships
   */
  validateDealAssociations(
    lineItems: DealAssociationData[],
    companies: DealAssociationData[]
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (lineItems.length === 0) {
      warnings.push('Deal has no associated line items');
    }

    if (companies.length === 0) {
      errors.push('Deal has no associated companies');
    }

    if (companies.length > 1) {
      warnings.push('Deal has multiple associated companies');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Checks if deal is a test deal based on naming convention
   */
  isTestDeal(dealname: string): boolean {
    const testKeywords = ['test', 'testing', 'demo', 'sample', 'vivacity'];
    return testKeywords.some(keyword =>
      dealname.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Checks if deal stage is invalid for processing
   */
  isInvalidDealStage(dealstage: string): boolean {
    const invalidStages = ['7', 'closedlost', 'dead'];
    return invalidStages.includes(dealstage.toLowerCase());
  }

  /**
   * Checks if deal stage indicates a closed deal
   */
  isDealStageClosed(dealstage: string): boolean {
    const closedStages = ['closedwon', 'closedlost', '6', '7'];
    return closedStages.includes(dealstage.toLowerCase());
  }

  /**
   * Checks if deal stage indicates a closed-won deal
   */
  isDealStageClosedWon(dealstage: string): boolean {
    const closedWonStages = ['closedwon', '6'];
    return closedWonStages.includes(dealstage.toLowerCase());
  }

  /**
   * Validates if the deal pipeline is valid for processing
   */
  isValidPipeline(pipeline: string): boolean {
    const validPipelines = ['default', 'sales_pipeline', '36643521'];
    return validPipelines.includes(pipeline) || !pipeline;
  }

  /**
   * Checks if line item is a placeholder item
   */
  isPlaceholderItem(lineItem: LineItemProperties): boolean {
    return lineItem.netsuite_id === '33575' || !lineItem.netsuite_id;
  }

  /**
   * Validates NetSuite opportunity data
   */
  validateNetSuiteOpportunity(opportunityData: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!opportunityData.title || opportunityData.title.trim() === '') {
      errors.push('Opportunity title is required');
    }

    if (!opportunityData.customerId || opportunityData.customerId.trim() === '') {
      errors.push('Opportunity customer ID is required');
    }

    const amount = Number(opportunityData.amount);
    if (isNaN(amount) || amount < 0) {
      errors.push('Opportunity amount must be a valid non-negative number');
    }

    if (!opportunityData.stage || opportunityData.stage.trim() === '') {
      warnings.push('Opportunity stage is not set');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates opportunity items data
   */
  validateOpportunityItems(items: any[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (items.length === 0) {
      warnings.push('No opportunity items provided');
      return { isValid: true, errors: [], warnings };
    }

    items.forEach((item, index) => {
      if (!item.quantity || Number(item.quantity) <= 0) {
        errors.push(`Item ${index + 1}: Invalid quantity`);
      }

      if (!item.rate || Number(item.rate) < 0) {
        errors.push(`Item ${index + 1}: Invalid rate`);
      }

      if (!item.item || !item.item.id) {
        errors.push(`Item ${index + 1}: Missing item ID`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates data consistency between HubSpot and NetSuite
   */
  validateDataConsistency(
    hubspotData: any,
    netsuiteData: any,
    entityType: 'deal' | 'lineItem'
  ): {
    isConsistent: boolean;
    discrepancies: string[];
  } {
    const discrepancies: string[] = [];

    if (entityType === 'deal') {
      if (Math.abs(Number(hubspotData.amount) - Number(netsuiteData.amount)) > 0.01) {
        discrepancies.push('Deal amounts do not match between systems');
      }

      if (hubspotData.dealstage !== this.mapDealStageFromNetSuite(netsuiteData.stage)) {
        discrepancies.push('Deal stages do not match between systems');
      }
    } else if (entityType === 'lineItem') {
      if (Math.abs(Number(hubspotData.price) - Number(netsuiteData.rate)) > 0.01) {
        discrepancies.push('Line item prices do not match between systems');
      }

      if (Number(hubspotData.quantity) !== Number(netsuiteData.quantity)) {
        discrepancies.push('Line item quantities do not match between systems');
      }
    }

    return {
      isConsistent: discrepancies.length === 0,
      discrepancies
    };
  }

  /**
   * Maps NetSuite opportunity stage to HubSpot deal stage
   */
  private mapDealStageFromNetSuite(nsStage: string): string {
    const reverseStageMappings: Record<string, string> = {
      '1': 'qualifiedtobuy',
      '2': 'presentationscheduled',
      '3': 'decisionmakerboughtin',
      '4': 'contractsent',
      '5': 'closedwon',
      '6': 'closedwon',
      '7': 'closedlost'
    };

    return reverseStageMappings[nsStage] || 'qualifiedtobuy';
  }

  /**
   * Comprehensive validation for deal processing
   */
  validateDealForProcessing(
    dealProperties: DealProperties,
    associations: { lineItems: DealAssociationData[]; companies: DealAssociationData[] }
  ): {
    canProcess: boolean;
    reason?: string;
    validationDetails: {
      dealValidation: ReturnType<ValidationService['validateDealProperties']>;
      associationValidation: ReturnType<ValidationService['validateDealAssociations']>;
    };
  } {
    const dealValidation = this.validateDealProperties(dealProperties);
    const associationValidation = this.validateDealAssociations(
      associations.lineItems,
      associations.companies
    );

    // Check for blocking errors
    if (!dealValidation.isValid) {
      return {
        canProcess: false,
        reason: `Deal validation failed: ${dealValidation.errors.join(', ')}`,
        validationDetails: { dealValidation, associationValidation }
      };
    }

    if (!associationValidation.isValid) {
      return {
        canProcess: false,
        reason: `Association validation failed: ${associationValidation.errors.join(', ')}`,
        validationDetails: { dealValidation, associationValidation }
      };
    }

    // Check business rules
    if (this.isTestDeal(dealProperties.dealname)) {
      return {
        canProcess: false,
        reason: 'Deal is identified as a test deal',
        validationDetails: { dealValidation, associationValidation }
      };
    }

    if (this.isInvalidDealStage(dealProperties.dealstage)) {
      return {
        canProcess: false,
        reason: 'Deal stage is not valid for processing',
        validationDetails: { dealValidation, associationValidation }
      };
    }

    if (!this.isValidPipeline(dealProperties.pipeline)) {
      return {
        canProcess: false,
        reason: 'Deal pipeline is not valid for processing',
        validationDetails: { dealValidation, associationValidation }
      };
    }

    return {
      canProcess: true,
      validationDetails: { dealValidation, associationValidation }
    };
  }
}

export default new ValidationService();
