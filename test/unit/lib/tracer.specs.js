
const mockery = require('mockery')

const test = require('../../../index')

test.describe('tracer', () => {
  const TracerLibMock = function () {
    let preprocessCb
    let format
    let dateFormat

    const fakeColorConsole = function (options) {
      preprocessCb = options.preprocess
      format = options.format
      dateFormat = options.dateformat
    }

    const preprocess = function (data) {
      preprocessCb(data)
    }

    const getFormat = function () {
      return format
    }

    const getDateFormat = function () {
      return dateFormat
    }

    return {
      fakeColorConsole: fakeColorConsole,
      preprocess: preprocess,
      getFormat: getFormat,
      getDateFormat: getDateFormat
    }
  }
  const tracerLibMock = new TracerLibMock()
  let tracerLib

  test.before(() => {
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    })
    tracerLib = require('tracer')
    test.sinon.stub(tracerLib, 'colorConsole').callsFake(tracerLibMock.fakeColorConsole)
    require('../../../lib/tracer')
  })

  test.after(() => {
    tracerLib.colorConsole.restore()
    mockery.disable()
  })

  test.it('should initialize the used tracer library', () => {
    test.expect(tracerLib.colorConsole).to.have.been.called()
  })

  test.it('should add time to all logs', () => {
    test.expect(tracerLibMock.getDateFormat()).to.contain('HH:MM:ss')
    test.expect(tracerLibMock.getFormat()[0]).to.contain('{{timestamp}}')
  })

  test.it('should add "Narval" to all logs', () => {
    const narval = 'Narval'
    const format = tracerLibMock.getFormat()
    test.expect(format[0]).to.contain(narval)
    test.expect(format[1].error).to.contain(narval)
  })

  test.it('should convert the type of log to uppercase', () => {
    let data = {
      title: 'foo'
    }
    tracerLibMock.preprocess(data)
    test.expect(data.title).to.equal('FOO')
  })

  test.it('should not print the stack in error logs, unless is received an error object', () => {
    let data = {
      title: 'error',
      args: [
        'Error message'
      ]
    }
    tracerLibMock.preprocess(data)
    test.expect(data.stack).to.equal('')
  })

  test.it('should print the stack in error logs, when received an error object', () => {
    const fooErrorStack = 'Foo error stack'
    const error = new Error()
    error.stack = fooErrorStack
    let data = {
      title: 'error',
      args: [
        error
      ]
    }
    tracerLibMock.preprocess(data)
    test.expect(tracerLibMock.getFormat()[1].error).to.contain('{{stack}}')
    test.expect(data.stack).to.contain(fooErrorStack)
  })
})
