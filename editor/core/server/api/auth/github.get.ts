export default defineOAuthGitHubEventHandler({
  config: {
    /**
     * @see https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps
     */
    scope: [
      'read:user',
      'user:email',

      'repo',
      'admin:org',
    ],
    emailRequired: true,
  },
  async onSuccess(event, { user, tokens }) {
    await setUserSession(event, {
      user: {
        github: {
          ...user,

          access_token: tokens.access_token,
        },
      },
      secure: {
        tokens,
      },
      loggedInAt: new Date(),
    })
    return sendRedirect(event, '/')
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error('GitHub OAuth error:', error)
    return sendRedirect(event, '/')
  },
})
