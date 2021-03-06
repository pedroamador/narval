'use strict'

const fs = require('fs')
const path = require('path')

const Promise = require('bluebird')
const fsExtra = require('fs-extra')

const userLogs = require('./logs')

const DEFAULT_CONFIG_FILE = 'default-config.yml'
const CONFIG_FILE = '.narval.yml'
const LOGS_PATH = path.join('.narval', 'logs')
const DOCKER_PATH = path.join('.narval', 'docker')

const PathsResolver = function (basePath) {
  return function () {
    const filePaths = Array.prototype.slice.call(arguments)
    filePaths.unshift(basePath)
    return path.resolve.apply(this, filePaths)
  }
}

const PathExistsSync = function (pathResolver) {
  return function () {
    return fs.existsSync(pathResolver.apply(this, arguments))
  }
}

const EnsureDir = function (pathResolver) {
  return function () {
    const absolutePath = pathResolver.apply(this, arguments)
    return fsExtra.ensureDir(absolutePath)
      .then(() => {
        return Promise.resolve(absolutePath)
      })
  }
}

const Remove = function (pathResolver) {
  return function () {
    return fsExtra.remove(pathResolver.apply(this, arguments))
  }
}

const ReadFile = function (pathResolver) {
  return function () {
    const absolutePath = pathResolver.apply(this, arguments)
    return new Promise((resolve, reject) => {
      fs.readFile(absolutePath, 'utf8', (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
}

const WriteFile = function (pathResolver) {
  return function (relativePath, content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(pathResolver(relativePath), content, 'utf8', (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
}

const PathMethods = function (basePath) {
  const resolver = new PathsResolver(basePath)
  const existsSync = new PathExistsSync(resolver)
  const ensureDir = new EnsureDir(resolver)
  const readFile = new ReadFile(resolver)
  const writeFile = new WriteFile(resolver)
  const remove = new Remove(resolver)
  const base = function () {
    return basePath
  }

  return {
    base: base,
    ensureDir: ensureDir,
    existsSync: existsSync,
    readFile: readFile,
    remove: remove,
    resolve: resolver,
    writeFile: writeFile
  }
}

const cwdMethods = new PathMethods(process.cwd())
const packageMethods = new PathMethods(path.resolve(__dirname, '..'))

const defaultConfig = function () {
  return packageMethods.resolve(DEFAULT_CONFIG_FILE)
}

const customConfig = function () {
  return cwdMethods.resolve(CONFIG_FILE)
}

const logs = function () {
  return cwdMethods.resolve(LOGS_PATH)
}

cwdMethods.cleanLogs = function () {
  const logsPath = Array.prototype.slice.call(arguments)
  logsPath.unshift(LOGS_PATH)
  return cwdMethods.remove.apply(this, logsPath)
    .then(() => {
      return cwdMethods.ensureDir.apply(this, logsPath)
    })
}

const docker = function () {
  return cwdMethods.resolve(DOCKER_PATH)
}

const findDependencyFile = function (filePath, originPath) {
  const FIND_LIMIT = 5
  let i
  let absoluteFilePath = null

  originPath = originPath || __dirname
  filePath = filePath || []
  if (typeof filePath === 'string') {
    filePath = [filePath]
  }

  filePath.unshift('node_modules')

  for (i = 0; i < FIND_LIMIT; i++) {
    if (!absoluteFilePath) {
      let tryPath = path.resolve.apply(this, [originPath].concat(Array(1 + i).fill('..')).concat(filePath))
      if (fs.existsSync(tryPath)) {
        absoluteFilePath = tryPath
      }
    }
  }

  if (!absoluteFilePath) {
    throw new Error(userLogs.dependencyNotFound({
      filePath: filePath.join(path.sep)
    }, false))
  }
  return absoluteFilePath
}

module.exports = {
  cwd: cwdMethods,
  package: packageMethods,
  defaultConfig: defaultConfig,
  customConfig: customConfig,
  logs: logs,
  findDependencyFile: findDependencyFile,
  docker: docker
}
