
const Bluebird = require('bluebird')
const _ = require('lodash')

Bluebird.config({
  longStackTraces: true
})

const mocks = {
  ChildProcess: require('./lib/childProcess.mocks'),
  Config: require('./lib/config.mocks'),
  Fs: require('./lib/fs.mocks'),
  IstanbulMocha: require('./lib/istanbul-mocha.mocks'), // TODO, remove after refactor
  Logs: require('./lib/logs.mocks'),
  Options: require('./lib/options.mocks'),
  Paths: require('./lib/paths.mocks'),
  Processes: require('./lib/processes.mocks'),
  Tracer: require('./lib/tracer.mocks'),
  Utils: require('./lib/utils.mocks'),
  WaitOn: require('./lib/wait-on.mocks')
}

const Sandbox = function (mocksList) {
  let mocksToReturn = {}
  _.each(mocksList, (mockToCreate) => {
    mocksToReturn[mockToCreate] = new mocks[_.capitalize(mockToCreate)]()
  })

  const restore = function () {
    _.each(mocksToReturn, (mock) => {
      mock.restore()
    })
  }

  return Object.assign({}, mocksToReturn, {
    restore: restore
  })
}

module.exports = Object.assign({}, mocks, {
  Sandbox: Sandbox
})
