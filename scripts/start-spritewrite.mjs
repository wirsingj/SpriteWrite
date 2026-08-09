import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const args = process.argv.slice(2)

const rawPortArg = extractPortFromArguments(args)
const rawApiPortArg = extractPortFromArguments(args, '--api-port')
const resolvedUiPort = rawPortArg ?? parsePort(process.env.SPRITEWRITE_PORT) ?? parsePort(process.env.PORT) ?? 5173
const explicitApiPort = rawApiPortArg ?? parsePort(process.env.SPRITEWRITE_API_PORT)
const resolvedApiPort = resolveApiPort(resolvedUiPort, explicitApiPort)

const viteArgs = withoutLauncherArg(args, '--api-port')

const spawnEnv = {
  ...process.env,
  SPRITEWRITE_PORT: String(resolvedUiPort),
  SPRITEWRITE_API_PORT: String(resolvedApiPort),
}

const spawnOptions = {
  env: spawnEnv,
  shell: process.platform === 'win32',
  stdio: 'inherit',
}

const children = [
  spawn(npmCommand, ['run', 'dev:vite', '--', ...viteArgs], spawnOptions),
  spawn(npmCommand, ['run', 'api'], spawnOptions),
]

let shuttingDown = false

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    stopChildren()
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

process.on('SIGINT', () => {
  shuttingDown = true
  stopChildren()
  process.exit(130)
})

process.on('SIGTERM', () => {
  shuttingDown = true
  stopChildren()
  process.exit(143)
})

console.log(`Starting SpriteWrite UI on port ${resolvedUiPort} and API on port ${resolvedApiPort}`)

function resolveApiPort(uiPort, explicitApiPort) {
  if (typeof uiPort !== 'number' || !Number.isInteger(uiPort)) {
    return 5174
  }

  let apiPort = explicitApiPort ?? uiPort + 1
  if (apiPort <= 0 || apiPort > 65535) {
    apiPort = uiPort === 65535 ? uiPort - 1 : uiPort + 1
  }

  if (apiPort === uiPort) {
    apiPort = uiPort === 65535 ? uiPort - 1 : uiPort + 1
  }

  return apiPort
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
}

function parsePort(rawPort) {
  if (typeof rawPort !== 'string') {
    return undefined
  }

  const parsed = Number.parseInt(rawPort, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    return undefined
  }

  return parsed
}

function extractPortFromArguments(argv, flagName = '--port') {
  const index = argv.findIndex((value) => value === flagName)
  if (index === -1 || index + 1 >= argv.length) {
    return undefined
  }

  return parsePort(argv[index + 1])
}

function withoutLauncherArg(argv, flagName) {
  const index = argv.indexOf(flagName)
  if (index === -1) {
    return argv
  }
  if (index + 1 >= argv.length) {
    return argv.filter((value) => value !== flagName)
  }
  return argv.filter((value, i) => i !== index && i !== index + 1)
}

