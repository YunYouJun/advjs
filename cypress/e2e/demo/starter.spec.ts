context('Demo Starter', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('basic nav', () => {
    cy.url()
      .should('eq', 'http://localhost:3333/')

    // loading page
    cy.contains('@YunYouJun')
      .should('exist')

    // click start game
    cy.get('.start-menu-item')
      .first()
      .click()
      .wait(1000)
      .url()
      .should('include', '/#/game')
  })

  // it('markdown', () => {
  //   cy.get('[data-test-id="about"]')
  //     .click()
  //     .url()
  //     .should('eq', 'http://localhost:3333/about')

  //   cy.get('.shiki')
  //     .should('exist')
  // })
})
