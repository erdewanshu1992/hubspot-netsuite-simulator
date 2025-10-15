describe('CRM→ERP E2E (Mocked)', () => {
  it('creates an opportunity for a HubSpot deal', () => {
    cy.intercept('POST', '/erp/opportunities').as('postERP');

    cy.request('POST', '/webhooks/hubspot/deal', {
      objectId: 98765,
      objectType: 'deal',
      subscriptionType: 'deal.creation',
      occurredAt: Date.now()
    }).then((res) => {
      expect(res.status).to.be.oneOf([200]);
      expect(res.body.status).to.eq('ok');
    });

    cy.wait('@postERP').then(({ request, response }) => {
      expect(request.body).to.have.property('externalId', 'hs_deal_98765');
      expect(request.body).to.have.property('customerId');
      expect(response?.statusCode).to.be.oneOf([201]);
    });
  });

  it('ignores duplicate deal event (idempotent)', () => {
    cy.intercept('POST', '/erp/opportunities').as('postERP');

    const payload = {
      objectId: 2222,
      objectType: 'deal',
      subscriptionType: 'deal.creation',
      occurredAt: Date.now()
    };

    cy.request('POST', '/webhooks/hubspot/deal', payload).its('status').should('eq', 200);
    cy.wait('@postERP');

    cy.request('POST', '/webhooks/hubspot/deal', payload).then((res) => {
      expect([200, 400]).to.include(res.status);
    });
  });
});
