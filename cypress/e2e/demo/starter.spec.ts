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
      .url()
      .should('include', '/#/game')

    // first dialog
    cy.contains('你说世界上真的有外星人吗？')
      .should('exist')

    // click settings
    cy.get('.menu-setting-button')
      .first()
      .click()

    cy
      .contains('设置')
      .should('exist')
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
