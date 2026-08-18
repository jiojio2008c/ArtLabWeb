const { readdir, rm } = require('node:fs/promises')
const path = require('node:path')

const runtimeRoot = path.resolve(__dirname, '..')
const mode = process.argv[2]
const dryRun = process.argv.includes('--dry-run')
const keepDirectories = new Set(
  process.argv
    .filter((argument) => argument.startsWith('--keep='))
    .map((argument) => argument.slice('--keep='.length))
)
const validModes = new Set(['all', 'standard', 'vertical'])

if (!validModes.has(mode)) {
  console.error('Usage: node scripts/clean-release-directories.cjs <all|standard|vertical> [--dry-run]')
  process.exitCode = 1
  return
}

const isVerticalRelease = (name) => name.toLowerCase().includes('vertical')

const matchesMode = (name) => {
  if (mode === 'all') return true
  if (mode === 'vertical') return isVerticalRelease(name)
  return !isVerticalRelease(name)
}

const cleanReleaseDirectories = async () => {
  for (const directoryName of keepDirectories) {
    if (
      !directoryName.startsWith('release')
      || path.basename(directoryName) !== directoryName
      || directoryName.includes('/')
      || directoryName.includes('\\')
    ) {
      throw new Error(`Refusing unsafe keep directory name: ${directoryName}`)
    }
  }

  const entries = await readdir(runtimeRoot, { withFileTypes: true })
  const releaseDirectories = entries
    .filter((entry) => (
      entry.isDirectory()
      && entry.name.startsWith('release')
      && matchesMode(entry.name)
      && !keepDirectories.has(entry.name)
    ))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  if (releaseDirectories.length === 0) {
    console.log(`No ${mode} release directories to remove.`)
    return
  }

  for (const directoryName of releaseDirectories) {
    const targetPath = path.resolve(runtimeRoot, directoryName)
    if (path.dirname(targetPath) !== runtimeRoot || !path.basename(targetPath).startsWith('release')) {
      throw new Error(`Refusing to remove unsafe release path: ${targetPath}`)
    }

    console.log(`${dryRun ? 'Would remove' : 'Removing'} ${targetPath}`)
    if (!dryRun) {
      await rm(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 })
    }
  }
}

cleanReleaseDirectories().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
