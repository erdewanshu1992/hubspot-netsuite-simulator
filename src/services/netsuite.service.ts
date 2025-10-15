import axios from 'axios';
import axiosRetry from 'axios-retry';
import { ENV } from '../config/env';
import { OpportunityItem, PropertyChanges, Params } from '../types';

const NETSUITE_BASE_URL = `https://${ENV.NETSUITE_REST_DOMAIN}/app/site/hosting/restlet.nl`;
const NETSUITE_SCRIPT_ID = 'customscript_rl_hubspot_integration';
const NETSUITE_DEPLOYMENT_ID = 'customdeploy_rl_hubspot_integration';

// Create axios instance with retry configuration for NetSuite
const http = axios.create({
  baseURL: NETSUITE_BASE_URL,
  auth: {
    username: ENV.NETSUITE_TOKEN_ID,
    password: ENV.NETSUITE_TOKEN_SECRET
  },
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ENV.NETSUITE_TOKEN_ID}:${ENV.NETSUITE_TOKEN_SECRET}`
  }
});

axiosRetry(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err) || (err.response?.status || 0) >= 500
});

class NetSuiteService {
  async getOpportunityId(dealId: string): Promise<string | null> {
    try {
      const response = await http.get('/opportunity', {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'getOpportunityId',
          dealId: dealId
        }
      });
      return response.data.opportunityId || null;
    } catch (error) {
      throw new Error(`Failed to get NetSuite opportunity ID for deal ${dealId}: ${error}`);
    }
  }

  async getOpportunity(opportunityId: string): Promise<any> {
    try {
      const response = await http.get('/opportunity', {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'getOpportunity',
          opportunityId: opportunityId
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get NetSuite opportunity ${opportunityId}: ${error}`);
    }
  }

  async createOpportunity(opportunityData: any): Promise<string> {
    try {
      const response = await http.post('/opportunity', opportunityData, {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'createOpportunity'
        }
      });
      return response.data.opportunityId;
    } catch (error) {
      throw new Error(`Failed to create NetSuite opportunity: ${error}`);
    }
  }

  async updateOpportunity(opportunityId: string, opportunityData: any): Promise<void> {
    try {
      await http.put('/opportunity', opportunityData, {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'updateOpportunity',
          opportunityId: opportunityId
        }
      });
    } catch (error) {
      throw new Error(`Failed to update NetSuite opportunity ${opportunityId}: ${error}`);
    }
  }

  async patchOpportunityItems(
    opportunityId: string,
    data: PropertyChanges,
    params: Params,
    paramUrl: string
  ): Promise<void> {
    try {
      await http.patch(`/opportunity${paramUrl}`, data, {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'patchOpportunityItems',
          opportunityId: opportunityId,
          ...params
        }
      });
    } catch (error) {
      throw new Error(`Failed to patch opportunity items for ${opportunityId}: ${error}`);
    }
  }

  async getOpportunityItems(opportunityId: string): Promise<OpportunityItem[]> {
    try {
      const response = await http.get('/opportunity', {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'getOpportunityItems',
          opportunityId: opportunityId
        }
      });
      return response.data.items || [];
    } catch (error) {
      throw new Error(`Failed to get opportunity items for ${opportunityId}: ${error}`);
    }
  }

  async createOpportunityItem(opportunityId: string, itemData: OpportunityItem): Promise<string> {
    try {
      const response = await http.post('/opportunity/item', itemData, {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'createOpportunityItem',
          opportunityId: opportunityId
        }
      });
      return response.data.itemId;
    } catch (error) {
      throw new Error(`Failed to create opportunity item for ${opportunityId}: ${error}`);
    }
  }

  async updateOpportunityItem(opportunityId: string, itemId: string, itemData: OpportunityItem): Promise<void> {
    try {
      await http.put('/opportunity/item', itemData, {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'updateOpportunityItem',
          opportunityId: opportunityId,
          itemId: itemId
        }
      });
    } catch (error) {
      throw new Error(`Failed to update opportunity item ${itemId} for ${opportunityId}: ${error}`);
    }
  }

  async deleteOpportunityItem(opportunityId: string, itemId: string): Promise<void> {
    try {
      await http.delete('/opportunity/item', {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'deleteOpportunityItem',
          opportunityId: opportunityId,
          itemId: itemId
        }
      });
    } catch (error) {
      throw new Error(`Failed to delete opportunity item ${itemId} for ${opportunityId}: ${error}`);
    }
  }

  async syncOpportunityFromDeal(dealId: string, opportunityData: any): Promise<string> {
    try {
      // First try to get existing opportunity
      const opportunityId = await this.getOpportunityId(dealId);

      if (opportunityId) {
        // Update existing opportunity
        await this.updateOpportunity(opportunityId, opportunityData);
        return opportunityId;
      } else {
        // Create new opportunity
        const newOpportunityId = await this.createOpportunity(opportunityData);
        return newOpportunityId;
      }
    } catch (error) {
      throw new Error(`Failed to sync opportunity for deal ${dealId}: ${error}`);
    }
  }

  async getCustomer(customerId: string): Promise<any> {
    try {
      const response = await http.get('/customer', {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'getCustomer',
          customerId: customerId
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get NetSuite customer ${customerId}: ${error}`);
    }
  }

  async searchOpportunities(criteria: any): Promise<any[]> {
    try {
      const response = await http.post('/opportunity/search', criteria, {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'searchOpportunities'
        }
      });
      return response.data.opportunities || [];
    } catch (error) {
      throw new Error(`Failed to search NetSuite opportunities: ${error}`);
    }
  }

  async getItem(itemId: string): Promise<any> {
    try {
      const response = await http.get('/item', {
        params: {
          script: NETSUITE_SCRIPT_ID,
          deploy: NETSUITE_DEPLOYMENT_ID,
          action: 'getItem',
          itemId: itemId
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get NetSuite item ${itemId}: ${error}`);
    }
  }
}

export default new NetSuiteService();