import axios from 'axios';
import axiosRetry from 'axios-retry';
import { ENV } from '../config/env';
import {
  DealProperties,
  LineItemProperties,
  DealLineItem,
  DealAssociationData,
  UserData,
  PatchRecordProperties
} from '../types';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Create axios instance with retry configuration
const http = axios.create({ baseURL: HUBSPOT_BASE_URL });
axiosRetry(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err) || (err.response?.status || 0) >= 500
});

function authHeaders() {
 if (ENV.HUBSPOT_OAUTH_TOKEN) {
   return { Authorization: `Bearer ${ENV.HUBSPOT_OAUTH_TOKEN}` };
 }
 return {};
}

class HubSpotService {
 async getDeal(dealId: string): Promise<any> {
   try {
     const response = await http.get(`/crm/v3/objects/deals/${dealId}`, {
       headers: authHeaders(),
       params: ENV.HUBSPOT_OAUTH_TOKEN ? {
         properties: 'dealname,amount,pipeline,dealstage,hs_analytics_source,hs_deal_stage_probability,createdate,hs_lastmodifieddate,hs_object_id,netsuite_id,opportunity_number,purchasing_contract_id',
         associations: 'companies,contacts'
       } : {
         hapikey: ENV.HUBSPOT_API_KEY,
         properties: 'dealname,amount,pipeline,dealstage,hs_analytics_source,hs_deal_stage_probability,createdate,hs_lastmodifieddate,hs_object_id,netsuite_id,opportunity_number,purchasing_contract_id',
         associations: 'companies,contacts'
       }
     });
     return response.data;
   } catch (error) {
     throw new Error(`Failed to fetch deal ${dealId}: ${error}`);
   }
 }

 async getLineItem(itemId: string): Promise<DealLineItem> {
   try {
     const response = await http.get(`/crm/v3/objects/line_items/${itemId}`, {
       headers: authHeaders(),
       params: ENV.HUBSPOT_OAUTH_TOKEN ? {
         properties: 'hs_sku,quantity,price,amount,description,hs_position_on_quote,hs_cost_of_goods_sold,netsuite_id,ns_product_cost,ns_product_price,mohave_price,createdAt,updatedAt',
         associations: 'deals'
       } : {
         hapikey: ENV.HUBSPOT_API_KEY,
         properties: 'hs_sku,quantity,price,amount,description,hs_position_on_quote,hs_cost_of_goods_sold,netsuite_id,ns_product_cost,ns_product_price,mohave_price,createdAt,updatedAt',
         associations: 'deals'
       }
     });
     return response.data;
   } catch (error) {
     throw new Error(`Failed to fetch line item ${itemId}: ${error}`);
   }
 }

 async getDealItemsData(itemId: string): Promise<DealLineItem> {
   return this.getLineItem(itemId);
 }

 async updateDealProperties(dealId: string, properties: Record<string, any>): Promise<void> {
   try {
     await http.patch(`/crm/v3/objects/deals/${dealId}`, { properties }, { headers: authHeaders() });
   } catch (error) {
     throw new Error(`Failed to update deal ${dealId}: ${error}`);
   }
 }

 async updateItemPrice(itemId: string, data: PatchRecordProperties): Promise<void> {
   try {
     await http.patch(`/crm/v3/objects/line_items/${itemId}`, data, { headers: authHeaders() });
   } catch (error) {
     throw new Error(`Failed to update line item ${itemId} price: ${error}`);
   }
 }

 async getDealLineItems(dealId: string): Promise<DealAssociationData[]> {
   try {
     const response = await http.get(`/crm/v4/objects/deals/${dealId}/associations/line_items`, {
       headers: authHeaders()
     });
     return response.data.results || [];
   } catch (error) {
     throw new Error(`Failed to fetch line items for deal ${dealId}: ${error}`);
   }
 }

 async getDealCompanies(dealId: string): Promise<DealAssociationData[]> {
   try {
     const response = await http.get(`/crm/v4/objects/deals/${dealId}/associations/companies`, {
       headers: authHeaders()
     });
     return response.data.results || [];
   } catch (error) {
     throw new Error(`Failed to fetch companies for deal ${dealId}: ${error}`);
   }
 }

 async getDealUserData(userId: string): Promise<UserData> {
   try {
     const response = await http.get(`/crm/v3/owners/${userId}`, {
       headers: authHeaders()
     });
     const owner = response.data;
     return {
       id: owner.id,
       email: owner.email,
       firstName: owner.firstName,
       lastName: owner.lastName
     };
   } catch (error) {
     throw new Error(`Failed to fetch user data for ${userId}: ${error}`);
   }
 }

 async getDealProperties(dealId: string): Promise<DealProperties> {
   try {
     const dealData = await this.getDeal(dealId);
     return dealData.properties;
   } catch (error) {
     throw new Error(`Failed to fetch deal properties for ${dealId}: ${error}`);
   }
 }

 async getDealAssociations(dealId: string): Promise<{
   lineItems: DealAssociationData[];
   companies: DealAssociationData[];
 }> {
   try {
     const [lineItems, companies] = await Promise.all([
       this.getDealLineItems(dealId),
       this.getDealCompanies(dealId)
     ]);

     return {
       lineItems,
       companies
     };
   } catch (error) {
     throw new Error(`Failed to fetch deal associations for ${dealId}: ${error}`);
   }
 }

 verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
   // Implementation for webhook signature verification
   // This is a placeholder - implement proper HMAC verification
   return true;
 }

 // Batch operations for better performance
 async getMultipleLineItems(itemIds: string[]): Promise<DealLineItem[]> {
   const promises = itemIds.map(id => this.getLineItem(id));
   return Promise.all(promises);
 }

 async getMultipleDeals(dealIds: string[]): Promise<any[]> {
   const promises = dealIds.map(id => this.getDeal(id));
   return Promise.all(promises);
 }
}

// Export both the class and the original function for backward compatibility
export async function getDealProperties(dealId: string): Promise<DealProperties> {
 if (ENV.HUBSPOT_OAUTH_TOKEN) {
   const res = await http.get(`/crm/v3/objects/deals/${dealId}`, {
     headers: authHeaders(),
     params: { properties: 'dealname,amount,pipeline,dealstage,associatedcompanyid,hubspot_owner_id' }
   });
   const p = res.data.properties || {};
   return {
     dealname: p.dealname,
     amount: Number(p.amount || 0),
     pipeline: p.pipeline,
     dealstage: p.dealstage,
     companyId: p.associatedcompanyid,
     primaryContactId: p.hubspot_owner_id
   };
 } else if (ENV.HUBSPOT_API_KEY) {
   const res = await http.get(`/crm/v3/objects/deals/${dealId}`, {
     params: {
       hapikey: ENV.HUBSPOT_API_KEY,
       properties: 'dealname,amount,pipeline,dealstage,associatedcompanyid,hubspot_owner_id'
     }
   });
   const p = res.data.properties || {};
   return {
     dealname: p.dealname,
     amount: Number(p.amount || 0),
     pipeline: p.pipeline,
     dealstage: p.dealstage,
     companyId: p.associatedcompanyid,
     primaryContactId: p.hubspot_owner_id
   };
 }
 return {
   dealname: `Sample Deal ${dealId}`,
   amount: 1200,
   pipeline: '36643521',
   dealstage: 'qualifiedtobuy',
   companyId: 'cust_1001',
   primaryContactId: 'cont_2002'
 };
}

export default new HubSpotService();
