const fs = require('node:fs')
const path = require('node:path')

const packageSwiftPath = path.join(__dirname, '..', 'ios', 'App', 'CapApp-SPM', 'Package.swift')

if (!fs.existsSync(packageSwiftPath)) {
  console.warn(`[fix-ios-spm-paths] Package.swift not found: ${packageSwiftPath}`)
  process.exit(0)
}

const source = fs.readFileSync(packageSwiftPath, 'utf8')
const fixed = source.replace(/path:\s*"([^"]*node_modules[\\\/][^"]*)"/g, (match, packagePath) => {
  return match.replace(packagePath, packagePath.replace(/\\/g, '/'))
})

if (fixed !== source) {
  fs.writeFileSync(packageSwiftPath, fixed)
  console.log('[fix-ios-spm-paths] Normalized Package.swift local package paths.')
} else {
  console.log('[fix-ios-spm-paths] Package.swift local package paths already normalized.')
}
