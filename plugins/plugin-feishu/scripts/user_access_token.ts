import { consola } from 'consola'
import { colors } from 'consola/utils'
import { authorize, client, createServer } from '../src'

async function main() {
  const server = createServer()
  server.get('/api/oauth/callback', async (req, res) => {
    // todo
    // get query
    const { code, state, error } = req.query as { code: string, state: string, error?: 'access_denied' }
    if (error) {
      res.statusCode = 400
      res.end(`Error: ${error}`)
      return
    }
    else {
      consola.info(`Authorization code received: ${colors.green(code)}, state: ${colors.green(state)}`)
    }

    // init user access token
    await client.userAccessToken.initWithCode({
      advjs: code,
    }).then((token) => {
      consola.success('User access token initialized successfully.')
      console.log(token)
      res.json(token)
    }).catch((err) => {
      consola.error('Failed to initialize user access token:', err)
      res.statusCode = 500
      res.end(`Failed to initialize user access token: ${err.message}`)
    })
  })
  server.listen(3000)

  await authorize({
    redirectUri: 'http://localhost:3000/api/oauth/callback',
    scope: 'bitable:app',
    state: 'FROM_CLI',
  })
}

main()
