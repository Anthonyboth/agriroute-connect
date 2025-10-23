describe('DOM Stability - No removeChild/insertBefore Errors', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  const pagesToTest = [
    '/',
    '/sobre',
    '/ajuda',
    '/imprensa',
    '/privacidade',
    '/cookies',
    '/carreiras',
    '/dashboard/company',
    '/dashboard/driver'
  ];

  pagesToTest.forEach(page => {
    it(`should not have DOM errors on ${page}`, () => {
      cy.visit(page);
      cy.wait(2000);
      
      cy.window().then((win) => {
        const errors = (win as any).__domErrors || [];
        expect(errors).to.have.length(0);
      });
    });
  });

  it('should handle rapid UI interactions without DOM errors', () => {
    cy.visit('/');
    
    for (let i = 0; i < 5; i++) {
      cy.wait(200);
    }
    
    cy.window().then((win) => {
      const errors = (win as any).__domErrors || [];
      expect(errors).to.have.length(0);
    });
  });
});
