import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = resolve(projectRoot, 'node_modules/vite/bin/vite.js')
const extraArgs = process.argv.slice(2)

function readPortArg(args) {
  const portIndex = args.findIndex((arg) => arg === '--port' || arg === '-p')

  if (portIndex >= 0 && args[portIndex + 1]) {
    return args[portIndex + 1]
  }

  const inlinePort = args.find((arg) => arg.startsWith('--port='))
  if (inlinePort) {
    return inlinePort.slice('--port='.length)
  }

  return undefined
}

const port = readPortArg(extraArgs)

if (port) {
  process.env.STECUTE_DEV_PORT = port
}

await import('./ensure-dev-https-cert.mjs')

const child = spawn(process.execPath, [viteBin, '--host', '0.0.0.0', ...extraArgs], {
  cwd: projectRoot,
  env: {
    ...process.env,
    STECUTE_DEV_HTTPS: '1',
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
