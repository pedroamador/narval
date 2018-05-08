'use strict'

const events = require('events')
const fs = require('fs')
const fsExtra = require('fs-extra')
const path = require('path')
const Promise = require('bluebird')
const stripAnsi = require('strip-ansi')

const _ = require('lodash')

const paths = require('./paths')
const tracer = require('./tracer')

const Handler = function (proc, suiteData, options) {
  const eventBus = new events.EventEmitter()
  let filesReady = false
  let isClosed = false
  let logged = []

  let pending = {
    out: [],
    err: [],
    outerr: [],
    close: null
  }
  options = options || {}

  proc.on('close', (code) => {
    isClosed = true
    if (!filesReady && options.close) {
      pending.close = code
    }
  })

  proc.stdout.on('data', (data) => {
    if (!filesReady) {
      pending.out.push(data)
      pending.outerr.push(data)
    }
  })

  proc.stderr.on('data', (data) => {
    if (!filesReady) {
      pending.err.push(data)
      pending.outerr.push(data)
    }
  })

  const openFile = function (filePath) {
    return new Promise((resolve, reject) => {
      fs.open(filePath, 'a', (err, fd) => {
        if (err) {
          reject(err)
        }
        resolve(fd)
      })
    })
  }

  const DataLogger = function (fd, print, pendingKey) {
    let blankLine = ''
    const tracer = function (data) {
      data = _.trim(data)
      if (data.length) {
        let withourColors = stripAnsi(data)
        if (print) {
          console.log(data)
          logged.push(withourColors)
        }
        fs.appendFile(fd, stripAnsi(`${blankLine}${withourColors}`), 'utf8', (error) => {
          blankLine = '\n'
          if (error) {
            throw error
          }
        })
      }
    }
    if (pending[pendingKey].length) {
      _.each(pending[pendingKey], (trace) => {
        tracer(trace)
      })
    }

    return tracer
  }

  const closeFile = function (fileDescriptor) {
    return new Promise((resolve, reject) => {
      fs.close(fileDescriptor, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  const write = function () {
    const fileFolder = paths.cwd.resolve('.narval', 'logs', suiteData.type, suiteData.suite, suiteData.service)
    const outputFilePath = path.join(fileFolder, 'out.log')
    const errorFilePath = path.join(fileFolder, 'err.log')
    const outerrorFilePath = path.join(fileFolder, 'combined-outerr.log')
    const closeFilePath = path.join(fileFolder, 'exit-code.log')

    paths.cwd.ensureDir(fileFolder)
      .then(() => {
        return Promise.all([
          fsExtra.remove(outputFilePath),
          fsExtra.remove(errorFilePath),
          fsExtra.remove(outerrorFilePath),
          options.close ? fsExtra.remove(closeFilePath) : Promise.resolve()
        ])
          .then(() => {
            return Promise.props({
              out: openFile(outputFilePath),
              err: openFile(errorFilePath),
              outerr: openFile(outerrorFilePath)
            })
              .then((fileDescriptors) => {
                filesReady = true

                const out = new DataLogger(fileDescriptors.out, false, 'out')
                const err = new DataLogger(fileDescriptors.err, false, 'err')
                const outerr = new DataLogger(fileDescriptors.outerr, true, 'outerr')

                const closeAllFiles = function (code) {
                  return Promise.all([
                    closeFile(fileDescriptors.out),
                    closeFile(fileDescriptors.err),
                    closeFile(fileDescriptors.outerr)
                  ]).then(() => {
                    if (options.close) {
                      fs.writeFileSync(closeFilePath, code)
                    }
                    eventBus.emit('close', {
                      lastLog: logged[logged.length - 1],
                      processCode: code
                    })
                  }).catch((err) => {
                    eventBus.emit('error', err)
                  })
                }

                proc.stdout.on('data', (data) => {
                  out(data)
                  outerr(data)
                })

                proc.stderr.on('data', (data) => {
                  err(data)
                  outerr(data)
                })

                if (!isClosed) {
                  proc.on('close', (code) => {
                    closeAllFiles(code)
                  })
                } else {
                  closeAllFiles(pending.close)
                }
              })
          })
      })
      .catch((error) => {
        tracer.error(`Error writing process logs from service "${suiteData.service}", suite "${suiteData.suite}" of type "${suiteData.type}"`)
        tracer.error(error)
        eventBus.emit('error', error)
      })
  }

  write()

  return eventBus
}

module.exports = {
  Handler: Handler
}