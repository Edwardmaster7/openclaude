const fs = require('fs')
const path = require('path')

const VALID_MODES = ['off', 'lite', 'full', 'ultra']

function getDefaultMode() {
  const envMode = process.env.STONEAGE_DEFAULT_MODE
  if (envMode && VALID_MODES.includes(envMode)) {
    return envMode
  }
  return 'full'
}

function safeWriteFlag(flagPath, mode) {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Invalid stoneage mode: ${mode}`)
  }
  fs.writeFileSync(flagPath, mode, 'utf8')
  fs.chmodSync(flagPath, 0o600)
}

function readFlag(flagPath) {
  try {
    const stat = fs.lstatSync(flagPath)
    if (stat.isSymbolicLink()) {
      return null
    }

    // Read up to 64 bytes
    const fd = fs.openSync(flagPath, 'r')
    const buffer = Buffer.alloc(64)
    const bytesRead = fs.readSync(fd, buffer, 0, 64, 0)
    fs.closeSync(fd)

    const content = buffer.toString('utf8', 0, bytesRead)
    const sanitized = content.replace(/[^a-zA-Z0-9]/g, '')

    if (VALID_MODES.includes(sanitized)) {
      return sanitized
    }
    return null
  } catch (err) {
    return null
  }
}

function clearFlag(flagPath) {
  try {
    if (fs.existsSync(flagPath)) {
      fs.unlinkSync(flagPath)
    }
  } catch (err) {
    // Ignore error
  }
}

module.exports = {
  VALID_MODES,
  getDefaultMode,
  safeWriteFlag,
  readFlag,
  clearFlag,
}
