// HubSpot Types
export type HubSpotWebhookEvent = {
 objectId: number;
 objectType: 'deal' | 'line_item';
 subscriptionType: 'deal.creation' | 'deal.propertyChange' | 'line_item.creation' | 'line_item.propertyChange';
 occurredAt: number;
 propertyName?: string;
 propertyValue?: string;
};

export type ExpandedLineItemsHubSpotWebhookEvent = HubSpotWebhookEvent & {
 dealId: string;
 lineItemsData: {
   lineItemProperties: LineItemProperties;
   lineItemCreated: string;
 };
};

export type DealProperties = {
 dealname: string;
 amount: number;
 pipeline: string;
 dealstage: string;
 companyId?: string;
 primaryContactId?: string;
 hs_analytics_source?: string;
 hs_deal_stage_probability?: string;
 createdate?: string;
 hs_lastmodifieddate?: string;
 hs_object_id?: string;
 netsuite_id?: string;
 opportunity_number?: string;
 purchasing_contract_id?: string;
};

export type LineItemProperties = {
  hs_object_id: string;
  hs_sku?: string;
  quantity: string;
  price: string;
  amount?: string;
  description?: string;
  hs_position_on_quote?: string;
  hs_cost_of_goods_sold?: string;
  netsuite_id?: string;
  ns_product_cost?: string;
  ns_product_price?: string;
  mohave_price?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: string | undefined;
};

export type DealLineItem = {
 id: string;
 properties: LineItemProperties;
 associations?: {
   deals?: {
     results: Array<{
       id: string;
       type: string;
     }>;
   };
 };
 createdAt: string;
 updatedAt: string;
};

export type DealAssociationData = {
 id: string;
 type: string;
};

export type UserData = {
 id: string;
 email: string;
 firstName: string;
 lastName: string;
};

// NetSuite Types
export type OpportunityItem = {
 item?: {
   id: string;
 };
 quantity: number;
 rate: number;
 amount?: number;
 description?: string;
 custcol_itemmpn?: string;
 costestimatetype?: {
   id: string;
 };
 costestimate?: number;
 price?: {
   id: string;
 };
};

export type PropertyChanges = {
 item: {
   items: OpportunityItem[];
 };
};

export type Params = {
 replace?: string;
};

export type NetSuiteOpportunity = {
 id: string;
 externalId: string;
 title: string;
 amount: number;
 stage: string;
 customerId: string;
 items?: OpportunityItem[];
};

// Email Service Types
export type EmailConfig = {
 templateId: string;
 templateParams: {
   to_name: string;
   to_email: string;
   subject?: string;
   method_name?: string;
   method_location?: string;
   message?: string;
 };
};

// Validation and Response Types
export type DealPropertyCheckResponse = {
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
 cacheValid?: boolean;
};

// Function Parameter Types
export type CheckLineItemsDealValidityParams = {
 dealId: string;
 event?: ExpandedLineItemsHubSpotWebhookEvent;
 source: 'itemCreate' | 'itemPropChange' | 'quotePublished';
 friendlyHSProperty?: string;
 friendlyNSProperty?: string;
 hsValue?: string;
};

export type GetDealLineItemsParams = {
 dealLineItems: DealAssociationData[];
 lineItemProperties?: LineItemProperties;
 opportunityId: string;
 dealId: string;
 friendlyHSProperty?: string;
 hsValue?: string;
 source: string;
};

export type GetDealLineItemsOpportunityIdParams = {
 dealId: string;
 source: string;
 itemHSId?: string;
 itemNSId?: string;
 friendlyHSProperty?: string;
 hsValue?: string;
};

export type DealParseItemsParams = {
 dealLineItems: DealAssociationData[];
 lineItemProperties?: LineItemProperties;
 dealId: string;
 opportunityId: string;
 dealUpdatedById: string;
 source: string;
 friendlyHSProperty?: string;
 hsValue?: string;
};

export type GetDealLineItemsData = {
 lineItemAssociatedDealId: string;
 lineItemCreated: string;
 lineItemProperties: LineItemProperties;
};

export type FailedLineItems = {
 itemHSId: string;
 error: string;
};

export type PatchRecordProperties = {
 properties: Record<string, string>;
};

// Legacy/Compatibility Types
export type OpportunityPayload = {
 externalId: string;
 title: string;
 amount: number;
 pipeline: string;
 stage: string;
 customerId: string;
 items?: Array<{
   sku?: string;
   quantity: number;
   rate: number;
   nsItemId?: string;
 }>;
};
