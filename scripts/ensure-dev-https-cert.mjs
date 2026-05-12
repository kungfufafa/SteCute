import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const certDir = resolve(projectRoot, '.certs')

const caKeyPath = resolve(certDir, 'stecute-dev-ca.key')
const caCertPath = resolve(certDir, 'stecute-dev-ca.crt')
const caConfigPath = resolve(certDir, 'stecute-dev-ca.cnf')
const serverKeyPath = resolve(certDir, 'stecute-dev.key')
const serverCsrPath = resolve(certDir, 'stecute-dev.csr')
const serverCertPath = resolve(certDir, 'stecute-dev.crt')
const serverConfigPath = resolve(certDir, 'stecute-dev.cnf')
const manifestPath = resolve(certDir, 'stecute-dev-manifest.json')

const port = process.env.STECUTE_DEV_PORT ?? process.env.PORT ?? '5173'

function runOpenSsl(args) {
  try {
    execFileSync('openssl', args, { stdio: 'pipe' })
  } catch (error) {
    const stderr = error.stderr?.toString().trim()
    const stdout = error.stdout?.toString().trim()
    const detail = [stderr, stdout].filter(Boolean).join('\n')
    throw new Error(`OpenSSL failed: openssl ${args.join(' ')}${detail ? `\n${detail}` : ''}`)
  }
}

function localIPv4Addresses() {
  const addresses = new Set()

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.add(entry.address)
      }
    }
  }

  return Array.from(addresses).sort()
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    return undefined
  }

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return undefined
  }
}

function writeCaConfig() {
  writeFileSync(
    caConfigPath,
    [
      '[req]',
      'prompt = no',
      'distinguished_name = dn',
      'x509_extensions = v3_ca',
      '',
      '[dn]',
      'CN = Stecute Local Dev CA',
      'O = Stecute Local Development',
      '',
      '[v3_ca]',
      'basicConstraints = critical, CA:true',
      'keyUsage = critical, keyCertSign, cRLSign',
      'subjectKeyIdentifier = hash',
      '',
    ].join('\n'),
  )
}

function writeServerConfig({ dnsNames, ipAddresses }) {
  const altNames = [
    ...dnsNames.map((name, index) => `DNS.${index + 1} = ${name}`),
    ...ipAddresses.map((address, index) => `IP.${index + 1} = ${address}`),
  ]

  writeFileSync(
    serverConfigPath,
    [
      '[req]',
      'prompt = no',
      'distinguished_name = dn',
      'req_extensions = v3_req',
      '',
      '[dn]',
      'CN = localhost',
      'O = Stecute Local Development',
      '',
      '[v3_req]',
      'basicConstraints = CA:false',
      'keyUsage = critical, digitalSignature, keyEncipherment',
      'extendedKeyUsage = serverAuth',
      'subjectAltName = @alt_names',
      '',
      '[alt_names]',
      ...altNames,
      '',
    ].join('\n'),
  )
}

function relativePath(path) {
  return relative(projectRoot, path)
}

mkdirSync(certDir, { recursive: true })

const dnsNames = ['localhost']
const lanIpAddresses = localIPv4Addresses()
const ipAddresses = ['127.0.0.1', '::1', ...lanIpAddresses]
const manifest = { dnsNames, ipAddresses }
const previousManifest = readManifest()

const needsCa = !existsSync(caKeyPath) || !existsSync(caCertPath)
const needsServerCert =
  needsCa ||
  !existsSync(serverKeyPath) ||
  !existsSync(serverCertPath) ||
  JSON.stringify(previousManifest) !== JSON.stringify(manifest)

if (needsCa) {
  writeCaConfig()
  runOpenSsl(['genrsa', '-out', caKeyPath, '2048'])
  runOpenSsl([
    'req',
    '-x509',
    '-new',
    '-nodes',
    '-key',
    caKeyPath,
    '-sha256',
    '-days',
    '3650',
    '-out',
    caCertPath,
    '-config',
    caConfigPath,
  ])
  chmodSync(caKeyPath, 0o600)
}

if (needsServerCert) {
  writeServerConfig(manifest)

  if (!existsSync(serverKeyPath)) {
    runOpenSsl(['genrsa', '-out', serverKeyPath, '2048'])
    chmodSync(serverKeyPath, 0o600)
  }

  if (existsSync(serverCsrPath)) {
    unlinkSync(serverCsrPath)
  }

  runOpenSsl([
    'req',
    '-new',
    '-key',
    serverKeyPath,
    '-out',
    serverCsrPath,
    '-config',
    serverConfigPath,
  ])
  runOpenSsl([
    'x509',
    '-req',
    '-in',
    serverCsrPath,
    '-CA',
    caCertPath,
    '-CAkey',
    caKeyPath,
    '-CAcreateserial',
    '-out',
    serverCertPath,
    '-days',
    '825',
    '-sha256',
    '-extfile',
    serverConfigPath,
    '-extensions',
    'v3_req',
  ])

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

const urls = lanIpAddresses.map((address) => `https://${address}:${port}/`)

console.log('Dev HTTPS certificate is ready.')
console.log(`CA certificate for mobile trust: ${relativePath(caCertPath)}`)
console.log(`Server certificate: ${relativePath(serverCertPath)}`)

if (urls.length > 0) {
  console.log('LAN URLs:')
  for (const url of urls) {
    console.log(`  ${url}`)
  }
} else {
  console.log('No LAN IPv4 address was detected. Connect to Wi-Fi and rerun this command.')
}
