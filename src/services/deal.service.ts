import { DealProperties, DealAssociationData, UserData } from '../types';
import hubspotService from './hubspot.service';
import netsuiteService from './netsuite.service';
import { ENV } from '../config/env';

class DealService {
  /**
   * Validates deal properties and checks business rules
   */
  async checkDealProperties(dealId: string): Promise<{
    isDealTest: boolean;
    isInvalidStage: boolean;
    dealStageClosed: boolean;
    dealStageClosedWon: boolean;
    dealPipelineValid: boolean;
    opportunityNumber: string;
    netsuiteId: string;
    purchasingContractId: string;
    dealLineItems: DealAssociationData[];
    dealCompanies: DealAssociationData[];
    createdAt: string;
    dealUpdatedById: string;
  }> {
    try {
      // Get deal data from HubSpot
      const dealData = await hubspotService.getDeal(dealId);
      const dealProperties: DealProperties = dealData.properties;

      // Get deal associations
      const associations = await hubspotService.getDealAssociations(dealId);

      // Extract deal properties
      const dealname = dealProperties.dealname || '';
      const dealstage = dealProperties.dealstage || '';
      const pipeline = dealProperties.pipeline || '';
      const opportunityNumber = dealProperties.opportunity_number || '';
      const netsuiteId = dealProperties.netsuite_id || '';
      const purchasingContractId = dealProperties.purchasing_contract_id || '';
      const createdAt = dealProperties.createdate || '';
      const dealUpdatedById = dealProperties.primaryContactId || '';

      // Business rule validations
      const isDealTest = this.isTestDeal(dealname);
      const isInvalidStage = this.isInvalidDealStage(dealstage);
      const dealStageClosed = this.isDealStageClosed(dealstage);
      const dealStageClosedWon = this.isDealStageClosedWon(dealstage);
      const dealPipelineValid = this.isValidPipeline(pipeline);

      console.log("Deal Validation Results:", {
        dealId,
        isDealTest,
        isInvalidStage,
        dealStageClosed,
        dealStageClosedWon,
        dealPipelineValid,
        opportunityNumber,
        netsuiteId
      });

      return {
        isDealTest,
        isInvalidStage,
        dealStageClosed,
        dealStageClosedWon,
        dealPipelineValid,
        opportunityNumber,
        netsuiteId,
        purchasingContractId,
        dealLineItems: associations.lineItems,
        dealCompanies: associations.companies,
        createdAt,
        dealUpdatedById
      };

    } catch (error) {
      console.error(`Error checking deal properties for ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Checks if deal is a test deal based on naming convention
   */
  private isTestDeal(dealname: string): boolean {
    const testKeywords = ['test', 'testing', 'demo', 'sample', 'vivacity'];
    return testKeywords.some(keyword =>
      dealname.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Checks if deal stage is invalid for processing
   */
  private isInvalidDealStage(dealstage: string): boolean {
    const invalidStages = ['7', 'closedlost', 'dead'];
    return invalidStages.includes(dealstage.toLowerCase());
  }

  /**
   * Checks if deal stage indicates a closed deal
   */
  private isDealStageClosed(dealstage: string): boolean {
    const closedStages = ['closedwon', 'closedlost', '6', '7'];
    return closedStages.includes(dealstage.toLowerCase());
  }

  /**
   * Checks if deal stage indicates a closed-won deal
   */
  private isDealStageClosedWon(dealstage: string): boolean {
    const closedWonStages = ['closedwon', '6'];
    return closedWonStages.includes(dealstage.toLowerCase());
  }

  /**
   * Validates if the deal pipeline is valid for processing
   */
  private isValidPipeline(pipeline: string): boolean {
    // Add your valid pipeline IDs here
    const validPipelines = ['default', 'sales_pipeline', '36643521'];
    return validPipelines.includes(pipeline) || !pipeline; // Allow empty pipeline for flexibility
  }

  /**
   * Gets user data for the deal owner/updater
   */
  async getDealUserData(userId: string): Promise<UserData> {
    try {
      return await hubspotService.getDealUserData(userId);
    } catch (error) {
      console.error(`Error getting user data for ${userId}:`, error);
      // Return default user data if fetch fails
      return {
        id: userId,
        email: ENV.DEFAULT_ERROR_EMAIL_ADDRESS,
        firstName: ENV.DEFAULT_ERROR_TO_NAME,
        lastName: 'Team'
      };
    }
  }

  /**
   * Syncs a deal from HubSpot to NetSuite
   */
  async syncDealToNetSuite(dealId: string): Promise<string | null> {
    try {
      // Get deal data and validate
      const dealValidation = await this.checkDealProperties(dealId);

      // Skip processing for test deals
      if (dealValidation.isDealTest) {
        console.log(`Skipping test deal ${dealId}`);
        return null;
      }

      // Skip processing for invalid stages
      if (dealValidation.isInvalidStage) {
        console.log(`Skipping deal ${dealId} due to invalid stage`);
        return null;
      }

      // Skip processing for invalid pipelines
      if (!dealValidation.dealPipelineValid) {
        console.log(`Skipping deal ${dealId} due to invalid pipeline`);
        return null;
      }

      // Get deal properties for sync
      const dealData = await hubspotService.getDeal(dealId);
      const dealProperties: DealProperties = dealData.properties;

      // Get associated company
      const companyId = dealValidation.dealCompanies[0]?.id;
      if (!companyId) {
        throw new Error(`No associated company found for deal ${dealId}`);
      }

      // Transform and sync to NetSuite
      const opportunityData = {
        externalId: dealProperties.hs_object_id,
        title: dealProperties.dealname,
        amount: Number(dealProperties.amount) || 0,
        stage: this.mapDealStageToNetSuite(dealProperties.dealstage),
        customerId: companyId,
        custbody_deal_pipeline: dealProperties.pipeline,
        custbody_analytics_source: dealProperties.hs_analytics_source,
        probability: Number(dealProperties.hs_deal_stage_probability) || 0,
        custbody_hubspot_deal_id: dealProperties.hs_object_id,
        custbody_opportunity_number: dealProperties.opportunity_number
      };

      const opportunityId = await netsuiteService.syncOpportunityFromDeal(dealId, opportunityData);

      // Update HubSpot deal with NetSuite ID if not already present
      if (!dealProperties.netsuite_id) {
        await hubspotService.updateDealProperties(dealId, {
          netsuite_id: opportunityId
        });
      }

      return opportunityId;

    } catch (error) {
      console.error(`Error syncing deal ${dealId} to NetSuite:`, error);
      throw error;
    }
  }

  /**
   * Maps HubSpot deal stage to NetSuite opportunity stage
   */
  private mapDealStageToNetSuite(hsStage: string): string {
    const stageMappings: Record<string, string> = {
      'appointmentscheduled': '1', // Qualification
      'qualifiedtobuy': '2',       // Proposal
      'presentationscheduled': '3', // Negotiation
      'decisionmakerboughtin': '4', // Negotiation
      'contractsent': '5',         // Proposal
      'closedwon': '6',           // Closed Won
      'closedlost': '7'           // Closed Lost
    };

    return stageMappings[hsStage] || '1'; // Default to Qualification
  }

  /**
   * Updates deal properties in HubSpot based on NetSuite changes
   */
  async updateDealFromNetSuite(dealId: string, netsuiteData: {
    amount?: number;
    stage?: string;
    title?: string;
  }): Promise<void> {
    try {
      const updates: Record<string, any> = {};

      if (netsuiteData.amount) {
        updates.amount = netsuiteData.amount;
      }

      if (netsuiteData.stage) {
        updates.dealstage = this.mapDealStageFromNetSuite(netsuiteData.stage);
      }

      if (netsuiteData.title) {
        updates.dealname = netsuiteData.title;
      }

      if (Object.keys(updates).length > 0) {
        await hubspotService.updateDealProperties(dealId, updates);
      }

    } catch (error) {
      console.error(`Error updating deal ${dealId} from NetSuite:`, error);
      throw error;
    }
  }

  /**
   * Maps NetSuite opportunity stage to HubSpot deal stage
   */
  private mapDealStageFromNetSuite(nsStage: string): string {
    const reverseStageMappings: Record<string, string> = {
      '1': 'qualifiedtobuy',      // Qualification -> Qualified to Buy
      '2': 'presentationscheduled', // Proposal -> Presentation Scheduled
      '3': 'decisionmakerboughtin', // Negotiation -> Decision Maker Bought In
      '4': 'contractsent',        // Negotiation -> Contract Sent
      '5': 'closedwon',           // Closed Won
      '6': 'closedwon',           // Closed Won
      '7': 'closedlost'           // Closed Lost
    };

    return reverseStageMappings[nsStage] || 'qualifiedtobuy'; // Default to first stage if not found
  }

  /**
   * Validates if a deal can be processed based on all business rules
   */
  async validateDealForProcessing(dealId: string): Promise<{
    canProcess: boolean;
    reason?: string;
    opportunityId?: string;
  }> {
    try {
      const validation = await this.checkDealProperties(dealId);

      if (validation.isDealTest) {
        return { canProcess: false, reason: 'Deal is a test deal' };
      }

      if (validation.isInvalidStage) {
        return { canProcess: false, reason: 'Deal stage is invalid for processing' };
      }

      if (!validation.dealPipelineValid) {
        return { canProcess: false, reason: 'Deal pipeline is invalid' };
      }

      return {
        canProcess: true,
        opportunityId: validation.netsuiteId || undefined
      };

    } catch (error) {
      return {
        canProcess: false,
        reason: `Validation error: ${error}`
      };
    }
  }
}

export default new DealService();