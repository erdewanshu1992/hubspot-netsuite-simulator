import { EmailConfig } from "../../../../services/common/emailService/email.types";
import { PropertyChanges, Params } from "../../../../types/netsuite.types";
import { OpportunityItem } from "../../../netsuite/opportunities/opportunity.types";
import { DealAssociationData, DealPropertyCheckResponse } from "../deal.types";
import * as ES from "../../../../services/common/emailService/email.service";
import * as ERS from "../../../../services/common/errors.service";
import * as DS from "../deal.service";
import * as DIS from "./dealItem.service";
import * as OS from "../../../netsuite/opportunities/opportunityService";
import * as RC from "../../../../services/hubspot/redisCacheService/redisCache.service";
import * as DM from "../../../common/dataMapping/dataMapping.functions";
import * as CU from "../../../common/functions/hsNSUtility";
import { DEFAULT_ERROR_EMAIL_ADDRESS, DEFAULT_ERROR_TO_NAME } from "../../../common/email/email.constants";
import { HubSpotWebhookEvent, PatchRecordProperties, UserData } from "../../../../types/hubspot.types";
import { getFFValue } from "../../../../services/common/launchDarklyService/launchDarkly.service";
import { testCompanyCheck } from "../dealPropChange.controller2";
import { CheckLineItemsDealValidityParams, DealLineItem, DealParseItemsParams, ExpandedLineItemsHubSpotWebhookEvent, FailedLineItems, GetDealLineItemsData, GetDealLineItemsOpportunityIdParams, GetDealLineItemsParams, LineItemProperties } from "./dealItem.types";
import { DEAL_ITEM_FAILURE_MESSAGES } from "./dealItemErrorEmails";
import { redisClient } from "./dealItem.redisWorker";


let baseEmailConfig: EmailConfig = {
    templateId: ES.setTemplateId(),
    templateParams: {
        to_name: `Scott / ${DEFAULT_ERROR_TO_NAME}`,
        method_location: 'dealItems.controller',
        to_email: DEFAULT_ERROR_EMAIL_ADDRESS
    }
}
let dealUpdatedById: string;

export const itemCreation = async (expandedItemEvent: ExpandedLineItemsHubSpotWebhookEvent) => {
    console.log("ITEM CREATION EVENT");
    // ALREADY HAVE THE DEAL ID FROM THE EXPANDED EVENT FOR THAT ITEM
    // ALREADY HAVE THE LINE ITEM DATA FOR THIS ITEM
    const dealId: string = expandedItemEvent.dealId;
    try {
        // CHECK DEAL VALIDITY
        // isQuoteItemChange(already checked in item routes?)/isDealTest/isInvalidStage/dealStageClosed/dealPipelineValid
        // isTestCompany
        // GETS ALL LINE ITEMS
        const validityCheckParams: CheckLineItemsDealValidityParams = {
            dealId,
            event: expandedItemEvent,
            source: 'itemCreate'
        }
        const isDealItemCreationValid: DealPropertyCheckResponse = await checkItemDealValidity(validityCheckParams);
        const lineItemProperties: LineItemProperties = expandedItemEvent.lineItemsData?.lineItemProperties;
        const dealLineItems: DealAssociationData[] = isDealItemCreationValid.dealLineItems;
        const dealCompanies: DealAssociationData[] | [] = isDealItemCreationValid.dealCompanies;
        let opportunityId: string = isDealItemCreationValid.netsuiteId;
        const opportunityNumber: string = isDealItemCreationValid.opportunityNumber;
        const isInvalidStage: boolean = isDealItemCreationValid.isInvalidStage;
        const isDealTest: boolean = isDealItemCreationValid.isDealTest;
        const dealStageClosedWon: boolean = isDealItemCreationValid.dealStageClosedWon;
        const dealStageClosed: boolean = isDealItemCreationValid.dealStageClosed;

        // FALLBACK CHECK FOR OPP# / NS ID IF MISSING
        if (!opportunityId && opportunityNumber) {
            const params: GetDealLineItemsOpportunityIdParams = {
                dealId,
                itemHSId: lineItemProperties.hs_object_id,
                source: 'itemCreate'
            }
            opportunityId = await getOpportunityId(params);
        }

        if (dealStageClosed && !dealStageClosedWon) {
            console.log("Deal is Closed and not Closed Won, quitting.");
            return;
        }

        if (!dealStageClosedWon && !opportunityId) {
            // MAKE FALLBACK CHECK FOR OPP# / NS ID IF MISSING
            console.log("Deal Item Property Change has no Opportunity ID and Deal is not Closed Won, quitting.");
            return;
        }

        if (isDealTest) {
            console.log("Deal Item Creation is on a Test Deal, quitting.");
            return;
        }

        if (isInvalidStage) {
            console.log("Deal Item Creation Stage is invalid stage, quitting.");
            return;
        }

        const isTestCompany: boolean = testCompanyCheck(dealCompanies);
        if (isTestCompany) {
            console.log("Deal Item Creation Company is Vivacity Test, quitting.");
            return;
        }

        //     // QUIT IF PIPELINE IS NOT VALID
        if (!isDealItemCreationValid.dealPipelineValid) {
            console.error("Deal Property Change failed due to invalid Pipeline.")
            return;
        }
        const params: DealParseItemsParams = {
            dealLineItems,
            lineItemProperties,
            dealId: expandedItemEvent.dealId,
            opportunityId,
            dealUpdatedById,
            source: 'itemCreate'
        }

        // CALL PARSE ITEMS TO BUILD AND PATCH THE OPPORTUNITY ITEMS
        await parseItems(params);

    } catch (error) {
        throw error;
    }
}

/**
 * This function itemCreation
 * 1. itemCreation accepts a payload of an expanded item event
 * 2. 
 */

export const itemPropertyChange = async (expandedItemEvent: ExpandedLineItemsHubSpotWebhookEvent) => {

    const hsValue: string = String(expandedItemEvent.propertyValue);
    const hsProperty: string = String(expandedItemEvent.propertyName);
    const friendlyHSProperty: string = DM.mapHSInternalProperty(hsProperty, 'dealItems');
    const friendlyNSProperty: string = DM.mapNSInternalProperty(hsProperty, 'opportunityItems');
    console.log("ITEM PROPERTY CHANGE EVENT: ", hsProperty);

    const dealId: string = expandedItemEvent.dealId;
    // console.log("Item Prop Change Expanded Event Item Properties: ", expandedItemEvent.lineItemsData);
    try {
        // DO TIMESTAMP EQUALITY CHECK TO IGNORE CHANGES THAT ARE PART OF THE CREATE EVENT
        const timestampEqual = CU.timestampEqualityCheck(expandedItemEvent.occurredAt, expandedItemEvent.lineItemsData.lineItemCreated);
        console.log("Timestamp Equal: ", timestampEqual);
        // IF TIMESTAMPS ARE EQUAL CHANGE IS PART OF A CREATE EVENT, QUIT
        if (timestampEqual) {
            return;
        }

        // CHECK DEAL VALIDITY
        // isDealTest/isInvalidStage/dealStageClosed/dealPipelineValid
        // isTestCompany
        // GETS ALL LINE ITEMS
        const validityCheckParams: CheckLineItemsDealValidityParams = {
            dealId,
            event: expandedItemEvent,
            friendlyHSProperty,
            friendlyNSProperty,
            hsValue,
            source: 'itemPropChange'
        }
        const isDealItemPropertyChangeValid: DealPropertyCheckResponse = await checkItemDealValidity(validityCheckParams);
        const lineItemProperties: LineItemProperties = expandedItemEvent.lineItemsData?.lineItemProperties;
        const dealLineItems: DealAssociationData[] = isDealItemPropertyChangeValid.dealLineItems;
        const dealCompanies: DealAssociationData[] | [] = isDealItemPropertyChangeValid.dealCompanies;
        let opportunityId: string = isDealItemPropertyChangeValid.netsuiteId;
        const opportunityNumber: string = isDealItemPropertyChangeValid.opportunityNumber;
        const purchasingContractId: string = isDealItemPropertyChangeValid.purchasingContractId;
        const isInvalidStage: boolean = isDealItemPropertyChangeValid.isInvalidStage;
        const isDealTest: boolean = isDealItemPropertyChangeValid.isDealTest;
        const dealStageClosedWon: boolean = isDealItemPropertyChangeValid.dealStageClosedWon;
        const dealStageClosed: boolean = isDealItemPropertyChangeValid.dealStageClosed;

        // FALLBACK CHECK FOR OPP# / NS ID IF MISSING
        if (!opportunityId && opportunityNumber) {
            const params: GetDealLineItemsOpportunityIdParams = {
                dealId,
                itemHSId: lineItemProperties.hs_object_id,
                itemNSId: lineItemProperties.netsuite_id || '',
                source: 'itemPropChange',
                friendlyHSProperty,
                hsValue
            }
            opportunityId = await getOpportunityId(params);
        }

        if (dealStageClosed && !dealStageClosedWon) {
            console.log("Deal is Closed and not Closed Won, quitting.");
            return;
        }

        if (!dealStageClosedWon && !opportunityId) {
            console.log("Deal Item Property Change has no Opportunity ID and Deal is not Closed Won, quitting.");
            return;
        }

        if (isDealTest) {
            console.log("Deal Item Property Change is a Test Deal, quitting.");
            return;
        }

        if (isInvalidStage) {
            console.log("Deal Item Property Change Stage is invalid stage, quitting.");
            return;
        }

        const isTestCompany: boolean = testCompanyCheck(dealCompanies);
        if (isTestCompany) {
            console.log("Deal Item Property Change Company is Vivacity Test, quitting.");
            return;
        }

        // QUIT IF PREVIOUS REQUEST EXISTS IN CACHE
        if (!isDealItemPropertyChangeValid.cacheValid) {
            console.log("Deal Item Property Change failed due to previous request still existing in cache.");
            return;
        }

        //     // QUIT IF PIPELINE IS NOT VALID
        if (!isDealItemPropertyChangeValid.dealPipelineValid) {
            console.error("Deal Property Change failed due to invalid Pipeline.")
            return;
        }

        // CHECK IF PROP CHANGE IS price AND ITEM ASSOC DEAL PURCHASING CONTRACT IS MOHAVE
        // NEED TO HANDLE hs_margin_acv CHANGE TRIGGERED BY PRICE CHANGE
        if (hsProperty === 'price') {
            console.log("Mohave Price: ", lineItemProperties.mohave_price);
            if (purchasingContractId === '150' && lineItemProperties.mohave_price && lineItemProperties.mohave_price !== '0') {
                // STORE MOHAVE PRICE CHANGE EVENT TIMESTAMP IN REDIS AND EXPIRE AFTER 10 SECONDS
                const redisKey: string = `mohavePriceChange:${lineItemProperties.hs_object_id}`;
                await redisClient.set(redisKey, 'PROCESSING', "PX", 10000);
                console.log("Mohave Item price change, reverting.");
                const mohavePrice: string = lineItemProperties.mohave_price || '';
                if (hsValue === mohavePrice) {
                    return;
                } else {
                    await processMohavePriceChange(dealId, mohavePrice, lineItemProperties.hs_object_id);
                }
            }
            console.log("Item Property Change is price. Quitting");
            return;
        }

        // CHECK IF PROP CHANGE IS hs_margin_acv AND IF IT IS IN PROXIMITY TO THE MOHAVE PRICE CHANGE
        // IF SO, SKIP PROCESSING. IF NOT PROCESS.
        if (hsProperty === 'hs_margin_acv') {
            // RETRIEVE MOHAVE PRICE CHANGE TIMESTAMP FROM REDIS
            const mohaveTimestamp: string | null = await redisClient.get(`mohavePriceChange:${lineItemProperties.hs_object_id}`);
            console.log("Mohave Timestamp: ", mohaveTimestamp);
            // IF IT DOES NOT EXIST, OR IF THE ITEM ID IS DIFFERENT PROCESS CHANGE
            if (mohaveTimestamp) {
                console.log("hs_margin_acv Property Change is part of Mohave price change");
                return;
            }
            console.log("Item hs_margin_acv not part of Mohave price revert, processing.")

            try {
                // const dealLineItems: DealAssociationData[] = await getDealLineItems(dealId, 'itemPropChange');
                const params: DealParseItemsParams = {
                    dealLineItems,
                    lineItemProperties,
                    dealId: expandedItemEvent.dealId,
                    opportunityId,
                    dealUpdatedById,
                    friendlyHSProperty,
                    hsValue,
                    source: 'itemPropChange'
                }

                // CALL PARSE ITEMS TO BUILD AND PATCH THE OPPORTUNITY ITEMS
                await parseItems(params);
            } catch (error) {
                throw error;
            }
        }
    } catch (error) {
        throw error;
    }
}

export const quotePublishedItemsUpdate = async (dealId: string) => {
    console.log("Quote Published Items Update for Deal ID: ", dealId);
    // CHECK FOR DEAL VALIDITY
    // CHECK FOR NETSUITE ID / OPP# (RUN FALLBACK CHECK IF MISSING)
    try {
        // CHECK DEAL VALIDITY
        // isDealTest/isInvalidStage/dealStageClosed/dealPipelineValid
        // isTestCompany
        // GETS ALL LINE ITEMS
        const validityCheckParams: CheckLineItemsDealValidityParams = {
            dealId,
            source: 'quotePublished'
        }
        const isQuotePublishedDealValid: DealPropertyCheckResponse = await checkItemDealValidity(validityCheckParams);

        const dealLineItems: DealAssociationData[] = isQuotePublishedDealValid.dealLineItems;
        const dealCompanies: DealAssociationData[] | [] = isQuotePublishedDealValid.dealCompanies;
        let opportunityId: string = isQuotePublishedDealValid.netsuiteId;
        const opportunityNumber: string = isQuotePublishedDealValid.opportunityNumber;
        const isInvalidStage: boolean = isQuotePublishedDealValid.isInvalidStage;
        const isDealTest: boolean = isQuotePublishedDealValid.isDealTest;
        const dealStageClosedWon: boolean = isQuotePublishedDealValid.dealStageClosedWon;
        const dealStageClosed: boolean = isQuotePublishedDealValid.dealStageClosed;

        // FALLBACK CHECK FOR OPP# / NS ID IF MISSING
        if (!opportunityId && opportunityNumber) {
            const params: GetDealLineItemsOpportunityIdParams = {
                dealId,
                source: 'quotePublished'
            }
            opportunityId = await getOpportunityId(params);
        }

        if (dealStageClosed && !dealStageClosedWon) {
            console.log("Deal is Closed and not Closed Won, quitting.");
            return;
        }

        if (!dealStageClosedWon && !opportunityId) {
            console.log("Deal Item Property Change has no Opportunity ID and Deal is not Closed Won, quitting.");
            return;
        }

        if (isDealTest) {
            console.log("Deal Item Property Change is a Test Deal, quitting.");
            return;
        }

        if (isInvalidStage) {
            console.log("Deal Item Property Change Stage is invalid stage, quitting.");
            return;
        }

        const isTestCompany: boolean = testCompanyCheck(dealCompanies);
        if (isTestCompany) {
            console.log("Deal Item Property Change Company is Vivacity Test, quitting.");
            return;
        }

        // QUIT IF PREVIOUS REQUEST EXISTS IN CACHE
        if (!isQuotePublishedDealValid.cacheValid) {
            console.log("Deal Item Property Change failed due to previous request still existing in cache.");
            return;
        }

        //     // QUIT IF PIPELINE IS NOT VALID
        if (!isQuotePublishedDealValid.dealPipelineValid) {
            console.error("Deal Property Change failed due to invalid Pipeline.")
            return;
        }
        try {
            // const dealLineItems: DealAssociationData[] = await getDealLineItems(dealId, 'itemPropChange');
            const params: DealParseItemsParams = {
                dealLineItems,
                dealId: dealId,
                opportunityId,
                dealUpdatedById,
                source: 'quotePublished'
            }

            // CALL PARSE ITEMS TO BUILD AND PATCH THE OPPORTUNITY ITEMS
            await parseItems(params);
        } catch (error) {
            throw error;
        }
    } catch (error) {
        throw error;
    }

}

const checkItemDealValidity = async (params: CheckLineItemsDealValidityParams): Promise<DealPropertyCheckResponse> => {
    // SOURCE WILL BE itemCreate/itemPropChange/quotePublished
    const { dealId, event, source, friendlyHSProperty, hsValue, friendlyNSProperty } = params;
    try {
        let cacheValid: boolean = true;

        if (source === 'itemPropChange') {
            if (getFFValue('webhook-cache-check', false)) {
                const itemEvent = event as ExpandedLineItemsHubSpotWebhookEvent;
                const hsId = String(itemEvent.objectId);
                cacheValid = await checkCacheStatus(itemEvent, hsId, friendlyHSProperty as string, hsValue as string, friendlyNSProperty as string, 'Deal Item');
            }
        }

        const dealPropertyCheckResponse: DealPropertyCheckResponse = await DS.checkDealProperties(dealId);
        const dealStageClosed: boolean = dealPropertyCheckResponse.dealStageClosed;
        const dealStageClosedWon: boolean = dealPropertyCheckResponse.dealStageClosedWon;
        const createdAt: string = dealPropertyCheckResponse.createdAt;
        const dealPipelineValid: boolean = dealPropertyCheckResponse.dealPipelineValid;
        const isDealTest: boolean = dealPropertyCheckResponse.isDealTest;
        const isInvalidStage: boolean = dealPropertyCheckResponse.isInvalidStage;
        const opportunityNumber: string = dealPropertyCheckResponse.opportunityNumber;
        const netsuiteId: string = dealPropertyCheckResponse.netsuiteId;
        const purchasingContractId: string = dealPropertyCheckResponse.purchasingContractId;
        const dealLineItems: DealAssociationData[] | [] = dealPropertyCheckResponse.dealLineItems;
        const dealCompanies: DealAssociationData[] | [] = dealPropertyCheckResponse.dealCompanies;


        dealUpdatedById = dealPropertyCheckResponse.dealUpdatedById;
        console.log("Deal Stage Closed: ", dealStageClosed);
        console.log("Deal Pipeline Valid: ", dealPipelineValid);
        console.log("Is Invalid Stage: ", isInvalidStage);
        console.log("Is Deal Test: ", isDealTest);
        console.log("Deal Stage Closed Won: ", dealStageClosedWon);
        console.log("Deal Line Items: ", dealLineItems);

        return { isDealTest, isInvalidStage, dealStageClosed, dealStageClosedWon, dealPipelineValid, opportunityNumber, netsuiteId, purchasingContractId, dealLineItems, dealCompanies, createdAt, dealUpdatedById, cacheValid };

    } catch (error) {

        try {
            let itemNSId: string = event?.lineItemsData.lineItemProperties.netsuite_id || '';
            let subjectId: string;
            let params: string[] = [error as string, dealId];
            if (source === 'itemCreate') {
                subjectId = 'Item Creation';
                params = [...params, String(event?.objectId)]
            } else if (source === 'itemPropChange') {
                subjectId = 'Item Property Change';
                params = [...params, String(event?.objectId), friendlyHSProperty as string, hsValue as string, itemNSId]
            } else {
                // source IS quotePublished
                subjectId = 'Quote Publishing Deal Item Update';
            }

            const updatedByUserData: UserData = await DS.getDealUserData(dealUpdatedById);
            const emailConfig: EmailConfig = {
                ...baseEmailConfig,
                templateParams: {
                    ...baseEmailConfig.templateParams,
                    subject: `Deal ${dealId} ${subjectId} checking Deal validity`,
                    method_name: "checkItemDealValidity()",
                    message: DEAL_ITEM_FAILURE_MESSAGES[`${source}CheckItemDealValidity`](...params),
                    to_email: updatedByUserData.email,
                    to_name: updatedByUserData.firstName,
                },
            };
            await ES.sendEmail(emailConfig);
        } catch (error) {
            throw new Error(
                `Deal ${source} checkItemDealValidity() email failed`
            );
        }
        throw error;
    }
};

const checkCacheStatus = async (event: ExpandedLineItemsHubSpotWebhookEvent, hsId: string, hsProperty: string, hsValue: string, nsProperty: string, source: string,): Promise<boolean> => {
    // SOURCE IS itemPropChange
    const key: string = `${hsId}-${hsProperty}`;
    console.log("Cache Key: ", key);
    const storedRequest: ExpandedLineItemsHubSpotWebhookEvent | HubSpotWebhookEvent | null = await RC.getRequestFromCache(key, source, hsId, hsProperty, hsValue, 'opportunity', nsProperty);
    if (storedRequest) {
        if (event.occurredAt > storedRequest.occurredAt) {
            RC.deleteRequestFromCache(key, source, hsId, hsProperty, hsValue, 'opportunity', nsProperty);
            //console.log("Incoming request newer than old request. Deleting stored request from cache");
        } else {
            return false;
        }
    }

    RC.saveRequestToCache(event, key, source, hsId, hsProperty, hsValue, 'opportunity', nsProperty);
    //console.log("Saving incoming request to cache");
    return true;
}

const getOpportunityId = async (params: GetDealLineItemsOpportunityIdParams): Promise<string> => {
    // SOURCE IS itemCreate / itemPropChange / quotePublished
    const { dealId, source, itemHSId, itemNSId, friendlyHSProperty, hsValue } = params;
    try {
        await CU.processingDelay(1000);
        const opportunityId: string | null = await OS.getOpportunityId(dealId);
        return opportunityId || '';
    } catch (error) {
        try {
            let subjectId: string;
            let params: string[] = [error as string, dealId];
            if (source === 'itemCreate') {
                subjectId = 'Item Creation';
                params = [...params, itemHSId as string]
            } else if (source === 'itemPropChange') {
                subjectId = 'Item Property Change';
                params = [...params, itemHSId as string, friendlyHSProperty as string, hsValue as string, itemNSId as string]
            } else {
                // SOURCE IS quotePublished
                subjectId = 'Quote Publishing Deal Item Update';
            }
            const updatedByUserData: UserData = await DS.getDealUserData(dealUpdatedById);
            const emailConfig: EmailConfig = {
                ...baseEmailConfig,
                templateParams: {
                    ...baseEmailConfig.templateParams,
                    subject: `Deal ${dealId} ${subjectId} getting the NS Opportunity Id`,
                    method_name: "getOpportunityId()",
                    message: DEAL_ITEM_FAILURE_MESSAGES[`${source}GetOpportunityId`](...params),
                    to_email: updatedByUserData.email,
                    to_name: updatedByUserData.firstName,
                },
            };
            await ES.sendEmail(emailConfig);
        } catch (error) {
            throw new Error(
                `Deal ${source} getOpportunityId() email failed`
            );
        }
        throw error;
    }
}

const processMohavePriceChange = async (dealId: string, mohavePrice: string, itemHSId: string): Promise<void> => {
    try {
        // API CALL TO HS TO UPDATE LINE ITEM PRICE BACK TO THE MOHAVE PRICE
        const data: PatchRecordProperties = {
            properties: {
                price: mohavePrice
            }
        }
        await DIS.updateItemPrice(itemHSId, data);
    } catch (error) {
        try {
            const updatedByUserData: UserData = await DS.getDealUserData(dealUpdatedById);
            const emailConfig: EmailConfig = {
                ...baseEmailConfig,
                templateParams: {
                    ...baseEmailConfig.templateParams,
                    subject: `Getting Deal Line Item Data for Deal Item Event in Router`,
                    method_name: "processMohavePriceChange()",
                    message: DEAL_ITEM_FAILURE_MESSAGES.processMohavePriceChange(dealId, itemHSId, mohavePrice, error as string),
                    to_email: updatedByUserData.email,
                    to_name: updatedByUserData.firstName,
                },
            };
            await ES.sendEmail(emailConfig);
        } catch (error) {
            throw new Error(
                `Deal processMohavePriceChange() email failed.`
            );
        }
        throw error;
    }
}

export const getLineItemData = async (itemHSId: string): Promise<GetDealLineItemsData> => {
    // CALLED FROM itemRoutes
    try {
        const lineItemData: DealLineItem = await DIS.getDealItemsData(itemHSId);
        const lineItemAssociatedDealId: string = lineItemData.associations?.deals?.results[0].id || "";
        const lineItemCreated: string = lineItemData.createdAt;
        const lineItemProperties: LineItemProperties = lineItemData.properties;
        return { lineItemAssociatedDealId, lineItemCreated, lineItemProperties };
    } catch (error) {
        if (ERS.checkErrorMessageString(error, "Not Found")) {
            console.error(`Deal Item ${itemHSId} not found.`);
            return { lineItemAssociatedDealId: "", lineItemCreated: "", lineItemProperties: {} as LineItemProperties };
        } else {
            try {
                // const updaterUserData: UserData = await DS.getDealUserData(dealUpdatedById);
                const emailConfig: EmailConfig = {
                    ...baseEmailConfig,
                    templateParams: {
                        ...baseEmailConfig.templateParams,
                        subject: `Getting Deal Line Item Data for Deal Item Event in Router`,
                        method_name: "getLineItemData()",
                        message: DEAL_ITEM_FAILURE_MESSAGES.getLineItemData(itemHSId, error as string),
                    },
                };
                await ES.sendEmail(emailConfig);
            } catch (error) {
                throw new Error(
                    `Deal getLineItemData() email failed.`
                );
            }
            throw error;
        }

    }
}

export const parseItems = async (params: DealParseItemsParams) => {
    // AT THIS POINT THERE ARE GUARANTEED TO BE ITEMS
    // SOURCE: dealAssocChange / itemPropChange / itemCreate /quotePublished
    // itemPropChange / itemCreate WILL HAVE THE LINE ITEM DATA FOR THE ITEM THAT TRIGGERED THE EVENT
    // itemPropChange / itemCreate / quotePublished WILL HAVE OPPORTUNITY ID OF STRING OR FALSEY STRING
    // lineItemProperties WILL BE UNDEFINED FOR dealAssocChange / quotePublished

    const { dealLineItems, lineItemProperties, opportunityId, dealId, friendlyHSProperty, hsValue, source } = params;

    // QUIT IF THERE IS NO OPPORTUNITY FOR THE ITEM ASSOCIATED DEAL
    if (!opportunityId) {
        return
    }

    console.log("DEAL ITEM CONTROLLER PARSE DEAL ITEM / ITEMS");
    console.log("Source: ", source);
    console.log("Deal Id: ", dealId);

    //  GET THE DEAL ITEMS DATA
    let getDealItemsParams: GetDealLineItemsParams = {
        dealLineItems,
        lineItemProperties,
        opportunityId,
        dealId,
        friendlyHSProperty,
        hsValue,
        source
    }
    const itemsData: LineItemProperties[] = await getDealItemsData(getDealItemsParams);
    // console.log("Deal Items Data: ", itemsData);
    if (itemsData.length > 0) {
        // BUILD THE OPPORTUNITY ITEMS OBJECT
        const opportunityItems: OpportunityItem[] = buildOpportunityItems(itemsData);
        // console.log("Opporunity Items: ", opportunityItems);
        // PATCH THE ITEMS TO THE OPPORTUNITY
        await patchOpportunityItems(opportunityItems, opportunityId, dealId, source);
    }
}


const getDealItemsData = async (params: GetDealLineItemsParams): Promise<LineItemProperties[]> => {
    // SOURCE: itemCreate / itemPropChange / dealAssocChange / quotePublished
    const { dealId, source, dealLineItems, lineItemProperties, opportunityId } = params;
    let itemsWithoutData: DealAssociationData[] = params.dealLineItems;
    const items: LineItemProperties[] = [];
    let failedItems: FailedLineItems[] = [];

    if (source === 'itemCreate' || source === 'itemPropChange') {
        // ITERATE THROUGH dealLineItems AND REMOVE ID OF ITEM THAT TRIGGERED THE itemPropChange / itemCreate
        // SINCE WE ALREADY HAVE THAT DATA, AND PUSH IT INTO THE items ARRAY
        itemsWithoutData = dealLineItems.filter(item => item.id !== params.lineItemProperties?.hs_object_id);
        items.push(lineItemProperties as LineItemProperties);
    }

    for (let item of itemsWithoutData) {
        try {
            const itemData: DealLineItem = await DIS.getDealItemsData(item.id);
            items.push(itemData.properties);
        } catch (error) {
            if (ERS.checkErrorMessageString(error, "Not Found")) {
                continue;
            }
            failedItems.push({ itemHSId: item.id, error: error as string });
        }
    }
    if (failedItems.length > 0) {
        // SOURCE: itemCreate / itemPropChange / dealAssocChange / quotePublished
        const params: (string | FailedLineItems[])[] = [dealId, failedItems, opportunityId as string,];
        let subjectId: string = "";

        if (source === 'itemCreate') {
            subjectId = `Item Creation`;
        } else if (source === 'itemPropChange') {
            subjectId = `Item Property Change`;
        } else if (source === 'quotePublished') {
            subjectId = 'Quote Publishing Deal Item Update';
        } else {
            // SOURCE IS dealAssocChange
            subjectId = `Item Deletion`;
        }
        try {
            const updaterUserData: UserData = await DS.getDealUserData(dealUpdatedById);
            const emailConfig: EmailConfig = {
                ...baseEmailConfig,
                templateParams: {
                    ...baseEmailConfig.templateParams,
                    subject: `Deal ${dealId} ${subjectId} getting Deal Items data`,
                    method_name: "getDealItemsData()",
                    message: DEAL_ITEM_FAILURE_MESSAGES[`${source}GetDealItemsData`](...params),
                    to_email: updaterUserData.email,
                    to_name: updaterUserData.firstName,
                },
            };
            await ES.sendEmail(emailConfig);
        } catch (error) {
            throw new Error(`Deal ${subjectId} getDealItemsData() email failed`);
        }
    }
    return items;
}

const buildOpportunityItems = (itemsData: LineItemProperties[]): OpportunityItem[] => {
    const sortedItemsData = [...itemsData].sort((a, b) => {
        const itemA = Number(a.hs_position_on_quote);
        const itemB = Number(b.hs_position_on_quote);
        return itemA - itemB;
    });
    // console.log("Sorted Items Data: ", sortedItemsData);
    const opportunityItems: OpportunityItem[] = sortedItemsData.map((dealItem) => {
        // costestimaterate = unit cost / amount = amount / description = description

        // IF YOU PASS THE QUANTITY AND RATE TO NS IT WILL CALCULATE THE AMOUNT, NO NEED TO PASS IT IN
        // IF IT IS A NS ITEM AND THERE IS NO CHANGE TO THE COST OR PRICE, CAN JUST PASS THE NS ID AND QUANTITY
        // IF A NS ITEM AND THERE IS A CHANGE TO THE COST OR PRICE, PASS THE NS ID, QUANTITY, AND RATE

        if (dealItem.netsuite_id === '33575' || !dealItem.netsuite_id) {
            return {
                item: { id: '33575' },
                custcol_itemmpn: dealItem.hs_sku,
                quantity: parseInt(dealItem.quantity),
                rate: Number(dealItem.price),
                costestimate: setCostEstimate(dealItem.hs_cost_of_goods_sold, dealItem.quantity),
                // description: setPlaceholderItemDescription(dealItem),
                description: dealItem.description,
                // amount: Number(dealItem.amount)
            }
        } else {
            const nsItemProperties = setNSItemProperties(dealItem)
            return nsItemProperties;
            // return {
            //     item: { id: dealItem.netsuite_id as string },
            //     // custcol_itemmpn: dealItem.hs_sku,
            //     quantity: parseInt(dealItem.quantity),
            //     rate: Number(dealItem.price),
            //     // amount: Number(dealItem.amount)
            // }
        }
    });
    console.log("Opportunity Items: ", opportunityItems);
    return opportunityItems;
}
const setNSItemProperties = (item: LineItemProperties): OpportunityItem => {
    // CHECK UNIT COST AGAINST NS PRODUCT COST
    // IF THEY ARE THE SAME, DO NOT PASS COSTESTIMATERATE OR COSTESTIMATETYPE
    // IF THEY ARE NOT THE SAME, PASS COSTESTIMATERATE AND COSTESTIMATETYPE 
    // CHECK UNIT PRICE AGAINST NS PRODUCT PRICE
    // IF THEY ARE THE SAME, DO NOT PASS RATE
    let opportunityItem: OpportunityItem = {
        item: { id: item.netsuite_id as string },
        quantity: parseInt(item.quantity),
        rate: Number(item.price),
    }

    if (item.hs_cost_of_goods_sold !== item.ns_product_cost) {
        opportunityItem.costestimatetype = { id: "CUSTOM" };
        opportunityItem.costestimate = setCostEstimate(item.hs_cost_of_goods_sold, item.quantity);

    }
    if (item.price !== item.ns_product_price) {
        opportunityItem.price = { id: "-1" };
    }

    return opportunityItem;
}

const setCostEstimate = (cost: string, quantity: string): number => {
    // SET THE COST ESTIMATE TO THE COST OF GOODS SOLD MULTIPLIED BY THE QUANTITY
    // ROUND TO 2 DECIMAL PLACES
    const estimatedCost = Math.round((Number(cost) * Number(quantity)) * 100) / 100;
    return estimatedCost;
}

export const patchOpportunityItems = async (opportunityItems: OpportunityItem[], opportunityId: string, dealId: string, source: string) => {
    // SOURCE: itemCreate / itemPropChange / dealAssocChange / quotePublished

    const data: PropertyChanges = {
        item: {
            items: opportunityItems,
        },
    };
    const params: Params = { replace: "item" };
    const paramUrl: string = "?replace=item";

    // PATCH THE DEAL ITEMS TO THE OPPORTUNITY
    try {
        await CU.processingDelay(1000);
        await OS.patchOpportunityItems(
            opportunityId,
            data,
            params,
            paramUrl
        );
    } catch (error) {
        let messageId: string = "";
        let subjectId: string = "";

        if (source === 'itemCreate') {
            subjectId = `Item Creation`;
        } else if (source === "itemPropChange") {
            subjectId = `Item Property Change`;
        } else if (source === 'quotePublished') {
            subjectId = `Quote Publishing Deal Item Update`;
        } else {
            // SOURCE IS dealAssocChange (item deletion)
            subjectId = 'Item Deletion';
        }
        try {
            const updaterUserData: UserData = await DS.getDealUserData(dealUpdatedById);
            const emailConfig: EmailConfig = {
                ...baseEmailConfig,
                templateParams: {
                    ...baseEmailConfig.templateParams,
                    subjectL: `Deal ${dealId} ${subjectId} patching Opportunity Items`,
                    method_name: "patchOpportunityItems()",
                    message: DEAL_ITEM_FAILURE_MESSAGES[`${messageId}PatchOpportunityItems`](dealId, opportunityId, error as string),
                    to_email: updaterUserData.email,
                    to_name: updaterUserData.firstName,
                },
            };
            await ES.sendEmail(emailConfig);
        } catch (error) {
            throw new Error(
                `Deal ${subjectId} patching Opportunity Items email failed`
            );
        }
        throw error;
    }
}
