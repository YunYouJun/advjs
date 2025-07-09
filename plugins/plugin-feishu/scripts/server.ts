import { createServer } from '../src'
import 'dotenv/config'

async function main() {
  const server = createServer()
  server.listen(3000)
}

main()
