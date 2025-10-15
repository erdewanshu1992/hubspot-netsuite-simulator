# HubSpot → NetSuite Simulator (CRM→ERP Integration)

Enterprise-style demo of a HubSpot-like CRM → NetSuite-like ERP sync:
- Webhook ingestion
- Validation and mapping
- Idempotency keys
- MongoDB persistence (ERP store)
- Structured logging with request IDs
- Retry and notifications
- Jest unit tests and Cypress mocked E2E

## Run locally

1) Start MongoDB on your machine (default localhost:27017)
2) Install deps and start
```bash
npm install
cp .env.example .env
npm run dev
```
3) Trigger a webhook
```bash
curl -X POST http://localhost:4000/webhooks/hubspot/deal   -H 'Content-Type: application/json'   -H 'x-request-id: demo-1'   -d '{"objectId":555,"objectType":"deal","subscriptionType":"deal.creation","occurredAt":1710000000}'
```
4) Verify ERP record
```bash
curl http://localhost:4000/erp/opportunities/hs_deal_555
```

## Tests
```bash
npm test
npm run cypress:open   # or: npm run cypress:run
```

## Notes
- If you have a HubSpot sandbox token, set HUBSPOT_OAUTH_TOKEN in `.env` to fetch real deal properties.
- Otherwise the service returns a stubbed deal for demo purposes.
