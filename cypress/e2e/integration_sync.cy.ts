describe('CRM→ERP E2E (Mocked)', () => {
  it('creates an opportunity for a HubSpot deal', () => {
    // Intercept the ERP API call
    cy.intercept('POST', '/erp/opportunities').as('postERP');

    // Send webhook payload
    cy.request('POST', '/webhooks/hubspot/deal', {
      objectId: 98765,
      objectType: 'deal',
      subscriptionType: 'deal.creation',
      occurredAt: Date.now()
    }).then((res) => {
      expect(res.status).to.be.oneOf([200]);
      expect(res.body.status).to.eq('ok');
    });

    // Wait for the intercepted ERP call and verify it
    cy.wait('@postERP').then((interception) => {
      expect(interception.request.body).to.have.property('externalId', 'hs_deal_98765');
      expect(interception.request.body).to.have.property('customerId');
      expect(interception.response?.statusCode).to.be.oneOf([201]);
    });
  });

  it('ignores duplicate deal event (idempotent)', () => {
    // Intercept the ERP API call
    cy.intercept('POST', '/erp/opportunities').as('postERP');

    const payload = {
      objectId: 2222,
      objectType: 'deal',
      subscriptionType: 'deal.creation',
      occurredAt: Date.now()
    };

    // First request should succeed
    cy.request('POST', '/webhooks/hubspot/deal', payload)
      .its('status')
      .should('eq', 200);

    // Wait for ERP call
    cy.wait('@postERP');

    // Duplicate request should be handled gracefully
    cy.request('POST', '/webhooks/hubspot/deal', payload).then((res) => {
      expect([200, 400]).to.include(res.status);
    });
  });
});
