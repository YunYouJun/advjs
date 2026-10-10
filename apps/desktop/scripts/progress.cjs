const process = require('node:process')

function reportDesktopProgress(stage, details = {}, write = message => process.stdout.write(message)) {
  write(`[desktop:forge] ${JSON.stringify({ stage, ...details })}\n`)
}

// Packager awaits callback-style hooks. Never leave its callback pending if
// writing a diagnostic fails, and do not return a Promise from these hooks.
function packagerProgressHook(stage, write) {
  return (buildPath, electronVersion, platform, arch, done) => {
    try {
      reportDesktopProgress(stage, { buildPath, electronVersion, platform, arch }, write)
    }
    catch (error) {
      done(error)
      return
    }
    done()
  }
}

module.exports = { packagerProgressHook, reportDesktopProgress }
