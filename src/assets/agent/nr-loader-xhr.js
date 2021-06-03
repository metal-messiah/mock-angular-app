window.NREUM || (NREUM={});__nr_require=// prelude.js edited from: https://github.com/substack/browser-pack/blob/master/prelude.js

// modules are defined as an array
// [ module function, map of requireuires ]
//
// map of requireuires is short require name -> numeric require

(function (modules, cache, entry) { // eslint-disable-line no-extra-parens
  function newRequire (name) {
    if (!cache[name]) {
      var m = cache[name] = {exports: {}}
      modules[name][0].call(m.exports, function (x) {
        var id = modules[name][1][x]
        return newRequire(id || x)
      }, m, m.exports)
    }
    return cache[name].exports
  }

  // If there is already an agent on the page, use it instead.
  if (typeof __nr_require === 'function') return __nr_require

  for (var i = 0; i < entry.length; i++) newRequire(entry[i])

  return newRequire
})
({1:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ee = require("ee")
var mapOwn = require(22)
var flags = {}
var flagArr

try {
  flagArr = localStorage.getItem('__nr_flags').split(',')
  if (console && typeof console.log === 'function') {
    flags.console = true
    if (flagArr.indexOf('dev') !== -1) flags.dev = true
    if (flagArr.indexOf('nr_dev') !== -1) flags.nrDev = true
  }
} catch (err) {
 // no op
}

if (flags.nrDev) ee.on('internal-error', function (err) { log(err.stack) })
if (flags.dev) ee.on('fn-err', function (args, origThis, err) { log(err.stack) })
if (flags.dev) {
  log('NR AGENT IN DEVELOPMENT MODE')
  log('flags: ' + mapOwn(flags, function (key, val) { return key }).join(', '))
}

function log (message) {
  try {
    if (flags.console) console.log(message)
  } catch (err) {
    // no op
  }
}

},{}],2:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var handle = require("handle")
var slice = require(23)
var ee = require("ee")
var loader = require("loader")
var getOrSet = require("gos")
var origOnerror = window.onerror
var handleErrors = false
var NR_ERR_PROP = 'nr@seenError'

if (loader.disabled) return

// skipNext counter to keep track of uncaught
// errors that will be the same as caught errors.
var skipNext = 0

// Declare that we are using err instrumentation
loader.features.err = true
require(1)

window.onerror = onerrorHandler

try {
  throw new Error()
} catch (e) {
  // Only wrap stuff if try/catch gives us useful data. It doesn't in IE < 10.
  if ('stack' in e) {
    require(6)
    require(5)

    if ('addEventListener' in window) {
      require(3)
    }

    if (loader.xhrWrappable) {
      require(7)
    }

    handleErrors = true
  }
}

ee.on('fn-start', function (args, obj, methodName) {
  if (handleErrors) skipNext += 1
})

ee.on('fn-err', function (args, obj, err) {
  if (handleErrors && !err[NR_ERR_PROP]) {
    getOrSet(err, NR_ERR_PROP, function getVal () {
      return true
    })
    this.thrown = true
    notice(err)
  }
})

ee.on('fn-end', function () {
  if (!handleErrors) return
  if (!this.thrown && skipNext > 0) skipNext -= 1
})

ee.on('internal-error', function (e) {
  handle('ierr', [e, loader.now(), true])
})

// FF and Android browsers do not provide error info to the 'error' event callback,
// so we must use window.onerror
function onerrorHandler (message, filename, lineno, column, errorObj) {
  try {
    if (skipNext) skipNext -= 1
    else notice(errorObj || new UncaughtException(message, filename, lineno), true)
  } catch (e) {
    try {
      handle('ierr', [e, loader.now(), true])
    } catch (err) {
    }
  }

  if (typeof origOnerror === 'function') return origOnerror.apply(this, slice(arguments))
  return false
}

function UncaughtException (message, filename, lineno) {
  this.message = message || 'Uncaught error with no additional information'
  this.sourceURL = filename
  this.line = lineno
}

// emits 'handle > error' event, which the error aggregator listens on
function notice (err, doNotStamp) {
  // by default add timestamp, unless specifically told not to
  // this is to preserve existing behavior
  var time = (!doNotStamp) ? loader.now() : null
  handle('err', [err, time])
}

},{}],3:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ee = require("ee").get('events')
var wrapFn = require("wrap-function")(ee, true)
var getOrSet = require("gos")

var XHR = XMLHttpRequest
var ADD_EVENT_LISTENER = 'addEventListener'
var REMOVE_EVENT_LISTENER = 'removeEventListener'

module.exports = ee

// Guard against instrumenting environments w/o necessary features
if ('getPrototypeOf' in Object) {
  findAndWrapNode(document)
  findAndWrapNode(window)
  findAndWrapNode(XHR.prototype)
} else if (XHR.prototype.hasOwnProperty(ADD_EVENT_LISTENER)) {
  wrapNode(window)
  wrapNode(XHR.prototype)
}

ee.on(ADD_EVENT_LISTENER + '-start', function (args, target) {
  var originalListener = args[1]

  var wrapped = getOrSet(originalListener, 'nr@wrapped', function () {
    var listener = {
      object: wrapHandleEvent,
      'function': originalListener
    }[typeof originalListener]

    return listener ? wrapFn(listener, 'fn-', null, (listener.name || 'anonymous')) : originalListener

    function wrapHandleEvent () {
      if (typeof originalListener.handleEvent !== 'function') return
      return originalListener.handleEvent.apply(originalListener, arguments)
    }
  })

  this.wrapped = args[1] = wrapped
})

ee.on(REMOVE_EVENT_LISTENER + '-start', function (args) {
  args[1] = this.wrapped || args[1]
})

function findAndWrapNode (object) {
  var step = object
  while (step && !step.hasOwnProperty(ADD_EVENT_LISTENER)) { step = Object.getPrototypeOf(step) }
  if (step) { wrapNode(step) }
}

function wrapNode (node) {
  wrapFn.inPlace(node, [ADD_EVENT_LISTENER, REMOVE_EVENT_LISTENER], '-', uniqueListener)
}

function uniqueListener (args, obj) {
  // Context for the listener is stored on itself.
  return args[1]
}

},{}],4:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ee = require("ee").get('fetch')
var slice = require(23)
var mapOwn = require(22)

module.exports = ee

var win = window
var prefix = 'fetch-'
var bodyPrefix = prefix + 'body-'
var bodyMethods = ['arrayBuffer', 'blob', 'json', 'text', 'formData']
var Req = win.Request
var Res = win.Response
var fetch = win.fetch
var proto = 'prototype'
var ctxId = 'nr@context'

if (!(Req && Res && fetch)) {
  return
}

mapOwn(bodyMethods, function (i, name) {
  wrapPromiseMethod(Req[proto], name, bodyPrefix)
  wrapPromiseMethod(Res[proto], name, bodyPrefix)
})

wrapPromiseMethod(win, 'fetch', prefix)

ee.on(prefix + 'end', function (err, res) {
  var ctx = this
  if (res) {
    var size = res.headers.get('content-length')
    if (size !== null) {
      ctx.rxSize = size
    }
    ee.emit(prefix + 'done', [null, res], ctx)
  } else {
    ee.emit(prefix + 'done', [err], ctx)
  }
})

function wrapPromiseMethod (target, name, prefix) {
  var fn = target[name]
  if (typeof fn === 'function') {
    target[name] = function () {
      var args = slice(arguments)

      var ctx = {}
      // we are wrapping args in an array so we can preserve the reference
      ee.emit(prefix + 'before-start', [args], ctx)
      var dtPayload
      if (ctx[ctxId] && ctx[ctxId].dt) dtPayload = ctx[ctxId].dt

      var promise = fn.apply(this, args)

      ee.emit(prefix + 'start', [args, dtPayload], promise)

      return promise.then(function (val) {
        ee.emit(prefix + 'end', [null, val], promise)
        return val
      }, function (err) {
        ee.emit(prefix + 'end', [err], promise)
        throw err
      })
    }
  }
}

},{}],5:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Request Animation Frame wrapper
var ee = require("ee").get('raf')
var wrapFn = require("wrap-function")(ee)

var equestAnimationFrame = 'equestAnimationFrame'

module.exports = ee

wrapFn.inPlace(window, [
  'r' + equestAnimationFrame,
  'mozR' + equestAnimationFrame,
  'webkitR' + equestAnimationFrame,
  'msR' + equestAnimationFrame
], 'raf-')

ee.on('raf-start', function (args) {
  // Wrap the callback handed to requestAnimationFrame
  args[0] = wrapFn(args[0], 'fn-')
})

},{}],6:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ee = require("ee").get('timer')
var wrapFn = require("wrap-function")(ee)

var SET_TIMEOUT = 'setTimeout'
var SET_INTERVAL = 'setInterval'
var CLEAR_TIMEOUT = 'clearTimeout'
var START = '-start'
var DASH = '-'

module.exports = ee

wrapFn.inPlace(window, [SET_TIMEOUT, 'setImmediate'], SET_TIMEOUT + DASH)
wrapFn.inPlace(window, [SET_INTERVAL], SET_INTERVAL + DASH)
wrapFn.inPlace(window, [CLEAR_TIMEOUT, 'clearImmediate'], CLEAR_TIMEOUT + DASH)

ee.on(SET_INTERVAL + START, interval)
ee.on(SET_TIMEOUT + START, timer)

function interval (args, obj, type) {
  args[0] = wrapFn(args[0], 'fn-', null, type)
}

function timer (args, obj, type) {
  this.method = type
  this.timerDuration = isNaN(args[1]) ? 0 : +args[1]
  args[0] = wrapFn(args[0], 'fn-', this, type)
}

},{}],7:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// wrap-events patches XMLHttpRequest.prototype.addEventListener for us.
require(3)

var baseEE = require("ee")
var ee = baseEE.get('xhr')
var wrapFn = require("wrap-function")(ee)
var originals = NREUM.o
var OrigXHR = originals.XHR
var MutationObserver = originals.MO
var Promise = originals.PR
var setImmediate = originals.SI

var READY_STATE_CHANGE = 'readystatechange'

var handlers = ['onload', 'onerror', 'onabort', 'onloadstart', 'onloadend', 'onprogress', 'ontimeout']
var pendingXhrs = []

module.exports = ee

var XHR = window.XMLHttpRequest = function (opts) {
  var xhr = new OrigXHR(opts)
  try {
    ee.emit('new-xhr', [xhr], xhr)
    xhr.addEventListener(READY_STATE_CHANGE, wrapXHR, false)
  } catch (e) {
    try {
      ee.emit('internal-error', [e])
    } catch (err) {}
  }
  return xhr
}

copy(OrigXHR, XHR)

XHR.prototype = OrigXHR.prototype

wrapFn.inPlace(XHR.prototype, ['open', 'send'], '-xhr-', getObject)

ee.on('send-xhr-start', function (args, xhr) {
  wrapOnreadystatechange(args, xhr)
  enqueuePendingXhr(xhr)
})
ee.on('open-xhr-start', wrapOnreadystatechange)

function wrapOnreadystatechange (args, xhr) {
  wrapFn.inPlace(xhr, ['onreadystatechange'], 'fn-', getObject)
}

function wrapXHR () {
  var xhr = this
  var ctx = ee.context(xhr)

  if (xhr.readyState > 3 && !ctx.resolved) {
    ctx.resolved = true
    ee.emit('xhr-resolved', [], xhr)
  }

  wrapFn.inPlace(xhr, handlers, 'fn-', getObject)
}

// Wrapping the onreadystatechange property of XHRs takes some special tricks.
//
// The issue is that the onreadystatechange property may be assigned *after*
// send() is called against an XHR. This is of particular importance because
// jQuery uses a single onreadystatechange handler to implement all of the XHR
// callbacks thtat it provides, and it assigns that property after calling send.
//
// There are several 'obvious' approaches to wrapping the onreadystatechange
// when it's assigned after send:
//
// 1. Try to wrap the onreadystatechange handler from a readystatechange
//    addEventListener callback (the addEventListener callback will fire before
//    the onreadystatechange callback).
//
//      Caveat: this doesn't work in Chrome or Safari, and in fact will cause
//      the onreadystatechange handler to not be invoked at all during the
//      firing cycle in which it is wrapped, which may break applications :(
//
// 2. Use Object.defineProperty to create a setter for the onreadystatechange
//    property, and wrap from that setter.
//
//      Caveat: onreadystatechange is not a configurable property in Safari or
//      older versions of the Android browser.
//
// 3. Schedule wrapping of the onreadystatechange property using a setTimeout
//    call issued just before the call to send.
//
//      Caveat: sometimes, the onreadystatechange handler fires before the
//      setTimeout, meaning the wrapping happens too late.
//
// The setTimeout approach is closest to what we use here: we want to schedule
// the wrapping of the onreadystatechange property when send is called, but
// ensure that our wrapping happens before onreadystatechange has a chance to
// fire.
//
// We achieve this using a hybrid approach:
//
// * In browsers that support MutationObserver, we use that to schedule wrapping
//   of onreadystatechange.
//
// * We have discovered that MutationObserver in IE causes a memory leak, so we
//   now will prefer setImmediate for IE, and use a resolved promise to schedule
//   the wrapping in Edge (and other browsers that support promises)
//
// * In older browsers that don't support MutationObserver, we rely on the fact
//   that the call to send is probably happening within a callback that we've
//   already wrapped, and use our existing fn-end event callback to wrap the
//   onreadystatechange at the end of the current callback.
//

if (MutationObserver) {
  var resolved = Promise && Promise.resolve()
  if (!setImmediate && !Promise) {
    var toggle = 1
    var dummyNode = document.createTextNode(toggle)
    new MutationObserver(drainPendingXhrs).observe(dummyNode, { characterData: true })
  }
} else {
  baseEE.on('fn-end', function (args) {
    // We don't want to try to wrap onreadystatechange from within a
    // readystatechange callback.
    if (args[0] && args[0].type === READY_STATE_CHANGE) return
    drainPendingXhrs()
  })
}

function enqueuePendingXhr (xhr) {
  pendingXhrs.push(xhr)
  if (MutationObserver) {
    if (resolved) {
      resolved.then(drainPendingXhrs)
    } else if (setImmediate) {
      setImmediate(drainPendingXhrs)
    } else {
      toggle = -toggle
      dummyNode.data = toggle
    }
  }
}

function drainPendingXhrs () {
  for (var i = 0; i < pendingXhrs.length; i++) {
    wrapOnreadystatechange([], pendingXhrs[i])
  }
  if (pendingXhrs.length) pendingXhrs = []
}

// Use the object these methods are on as their
// context store for the event emitter
function getObject (args, obj) {
  return obj
}

function copy (from, to) {
  for (var i in from) {
    to[i] = from[i]
  }
  return to
}

},{}],8:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var uniqueId = require(19)
var parseUrl = require(10)

module.exports = {
  generateTracePayload: generateTracePayload,
  shouldGenerateTrace: shouldGenerateTrace
}

function generateTracePayload (parsedOrigin) {
  if (!shouldGenerateTrace(parsedOrigin)) {
    return null
  }

  var nr = window.NREUM
  if (!nr.loader_config) {
    return null
  }

  var accountId = (nr.loader_config.accountID || '').toString() || null
  var agentId = (nr.loader_config.agentID || '').toString() || null
  var trustKey = (nr.loader_config.trustKey || '').toString() || null

  if (!accountId || !agentId) {
    return null
  }

  var spanId = uniqueId.generateSpanId()
  var traceId = uniqueId.generateTraceId()
  var timestamp = Date.now()

  var payload = {
    spanId: spanId,
    traceId: traceId,
    timestamp: timestamp
  }

  if (parsedOrigin.sameOrigin ||
      (isAllowedOrigin(parsedOrigin) && useTraceContextHeadersForCors())) {
    payload.traceContextParentHeader = generateTraceContextParentHeader(spanId, traceId)
    payload.traceContextStateHeader = generateTraceContextStateHeader(spanId, timestamp,
      accountId, agentId, trustKey)
  }

  if ((parsedOrigin.sameOrigin && !excludeNewrelicHeader()) ||
      (!parsedOrigin.sameOrigin && isAllowedOrigin(parsedOrigin) && useNewrelicHeaderForCors())) {
    payload.newrelicHeader = generateTraceHeader(spanId, traceId, timestamp, accountId,
      agentId, trustKey)
  }

  return payload
}

function generateTraceContextParentHeader(spanId, traceId) {
  return '00-' + traceId + '-' + spanId + '-01'
}

function generateTraceContextStateHeader(spanId, timestamp, accountId, appId, trustKey) {
  var version = 0
  var transactionId = ''
  var parentType = 1
  var sampled = ''
  var priority = ''

  return trustKey + '@nr=' + version + '-' + parentType + '-' + accountId +
    '-' + appId + '-' + spanId + '-' + transactionId + '-' + sampled + '-' + priority + '-' + timestamp
}

function generateTraceHeader (spanId, traceId, timestamp, accountId, appId, trustKey) {
  var hasBtoa = ('btoa' in window && typeof window.btoa === 'function')
  if (!hasBtoa) {
    return null
  }

  var payload = {
    v: [0, 1],
    d: {
      ty: 'Browser',
      ac: accountId,
      ap: appId,
      id: spanId,
      tr: traceId,
      ti: timestamp
    }
  }
  if (trustKey && accountId !== trustKey) {
    payload.d.tk = trustKey
  }

  return btoa(JSON.stringify(payload))
}

// return true if DT is enabled and the origin is allowed, either by being
// same-origin, or included in the allowed list
function shouldGenerateTrace (parsedOrigin) {
  return isDtEnabled() && isAllowedOrigin(parsedOrigin)
}

function isAllowedOrigin(parsedOrigin) {
  var allowed = false
  var dtConfig = {}

  if ('init' in NREUM && 'distributed_tracing' in NREUM.init) {
    dtConfig = NREUM.init.distributed_tracing
  }

  if (parsedOrigin.sameOrigin) {
    allowed = true
  } else if (dtConfig.allowed_origins instanceof Array) {
    for (var i = 0; i < dtConfig.allowed_origins.length; i++) {
      var allowedOrigin = parseUrl(dtConfig.allowed_origins[i])
      if (parsedOrigin.hostname === allowedOrigin.hostname &&
          parsedOrigin.protocol === allowedOrigin.protocol &&
          parsedOrigin.port === allowedOrigin.port) {
        allowed = true
        break
      }
    }
  }
  return allowed
}

function isDtEnabled() {
  if ('init' in NREUM && 'distributed_tracing' in NREUM.init) {
    return !!NREUM.init.distributed_tracing.enabled
  }
  return false
}

// exclude the newrelic header for same-origin calls
function excludeNewrelicHeader() {
  if ('init' in NREUM && 'distributed_tracing' in NREUM.init) {
    return !!NREUM.init.distributed_tracing.exclude_newrelic_header
  }
  return false
}

function useNewrelicHeaderForCors() {
  if ('init' in NREUM && 'distributed_tracing' in NREUM.init) {
    return NREUM.init.distributed_tracing.cors_use_newrelic_header !== false
  }
  return false
}

function useTraceContextHeadersForCors() {
  if ('init' in NREUM && 'distributed_tracing' in NREUM.init) {
    return !!NREUM.init.distributed_tracing.cors_use_tracecontext_headers
  }
  return false
}

},{}],9:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var loader = require("loader")

// Don't instrument Chrome for iOS, it is buggy and acts like there are URL verification issues
if (!loader.xhrWrappable || loader.disabled) return

var handle = require("handle")
var parseUrl = require(10)
var generateTracePayload = require(8).generateTracePayload
var ee = require("ee")
var handlers = [ 'load', 'error', 'abort', 'timeout' ]
var handlersLen = handlers.length
var id = require("id")
var ffVersion = require(15)
var dataSize = require(14)
var responseSizeFromXhr = require(11)

var origXHR = window.XMLHttpRequest

// Declare that we are using xhr instrumentation
loader.features.xhr = true

require(7)
require(4)

// Setup the context for each new xhr object
ee.on('new-xhr', function (xhr) {
  var ctx = this
  ctx.totalCbs = 0
  ctx.called = 0
  ctx.cbTime = 0
  ctx.end = end
  ctx.ended = false
  ctx.xhrGuids = {}
  ctx.lastSize = null
  ctx.loadCaptureCalled = false

  xhr.addEventListener('load', function (event) {
    captureXhrData(ctx, xhr)
  }, false)

  // In Firefox 34+, XHR ProgressEvents report pre-content-decoding sizes via
  // their 'loaded' property, rather than post-decoding sizes. We want
  // post-decoding sizes for consistency with browsers where that's all we have.
  // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1227674
  //
  // In really old versions of Firefox (older than somewhere between 5 and 10),
  // we don't reliably get a final XHR ProgressEvent which reflects the full
  // size of the transferred resource.
  //
  // So, in both of these cases, we fall back to not using ProgressEvents to
  // measure XHR sizes.

  if (ffVersion && (ffVersion > 34 || ffVersion < 10)) return

  // In Opera, ProgressEvents report loaded values that are too high.
  if (window.opera) return

  xhr.addEventListener('progress', function (event) {
    ctx.lastSize = event.loaded
  }, false)
})

ee.on('open-xhr-start', function (args) {
  this.params = { method: args[0] }
  addUrl(this, args[1])
  this.metrics = {}
})

ee.on('open-xhr-end', function (args, xhr) {
  if ('loader_config' in NREUM && 'xpid' in NREUM.loader_config && this.sameOrigin) {
    xhr.setRequestHeader('X-NewRelic-ID', NREUM.loader_config.xpid)
  }

  var payload = generateTracePayload(this.parsedOrigin)
  if (payload) {
    var added = false
    if (payload.newrelicHeader) {
      xhr.setRequestHeader('newrelic', payload.newrelicHeader)
      added = true
    }
    if (payload.traceContextParentHeader) {
      xhr.setRequestHeader('traceparent', payload.traceContextParentHeader)
      if (payload.traceContextStateHeader) {
        xhr.setRequestHeader('tracestate', payload.traceContextStateHeader)
      }
      added = true
    }
    if (added) {
      this.dt = payload
    }
  }
})

ee.on('send-xhr-start', function (args, xhr) {
  var metrics = this.metrics
  var data = args[0]
  var context = this

  if (metrics && data) {
    var size = dataSize(data)
    if (size) metrics.txSize = size
  }

  this.startTime = loader.now()

  this.listener = function (evt) {
    try {
      if (evt.type === 'abort' && !(context.loadCaptureCalled)) {
        context.params.aborted = true
      }
      if (evt.type !== 'load' || (context.called === context.totalCbs) && (context.onloadCalled || typeof (xhr.onload) !== 'function')) context.end(xhr)
    } catch (e) {
      try {
        ee.emit('internal-error', [e])
      } catch (err) {}
    }
  }

  for (var i = 0; i < handlersLen; i++) {
    xhr.addEventListener(handlers[i], this.listener, false)
  }
})

ee.on('xhr-cb-time', function (time, onload, xhr) {
  this.cbTime += time
  if (onload) this.onloadCalled = true
  else this.called += 1
  if ((this.called === this.totalCbs) && (this.onloadCalled || typeof (xhr.onload) !== 'function')) this.end(xhr)
})

ee.on('xhr-load-added', function (cb, useCapture) {
  // Ignore if the same arguments are passed to addEventListener twice
  var idString = '' + id(cb) + !!useCapture
  if (!this.xhrGuids || this.xhrGuids[idString]) return
  this.xhrGuids[idString] = true

  this.totalCbs += 1
})

ee.on('xhr-load-removed', function (cb, useCapture) {
  // Ignore if event listener didn't exist for this xhr object
  var idString = '' + id(cb) + !!useCapture
  if (!this.xhrGuids || !this.xhrGuids[idString]) return
  delete this.xhrGuids[idString]

  this.totalCbs -= 1
})

// Listen for load listeners to be added to xhr objects
ee.on('addEventListener-end', function (args, xhr) {
  if (xhr instanceof origXHR && args[0] === 'load') ee.emit('xhr-load-added', [args[1], args[2]], xhr)
})

ee.on('removeEventListener-end', function (args, xhr) {
  if (xhr instanceof origXHR && args[0] === 'load') ee.emit('xhr-load-removed', [args[1], args[2]], xhr)
})

// Listen for those load listeners to be called.
ee.on('fn-start', function (args, xhr, methodName) {
  if (xhr instanceof origXHR) {
    if (methodName === 'onload') this.onload = true
    if ((args[0] && args[0].type) === 'load' || this.onload) this.xhrCbStart = loader.now()
  }
})

ee.on('fn-end', function (args, xhr) {
  if (this.xhrCbStart) ee.emit('xhr-cb-time', [loader.now() - this.xhrCbStart, this.onload, xhr], xhr)
})

ee.on('fetch-before-start', function (args) {
  var opts = args[1] || {}
  var url
  // argument is USVString
  if (typeof args[0] === 'string') {
    url = args[0]
  // argument is Request object
  } else if (args[0] && args[0].url) {
    url = args[0].url
  // argument is URL object
  } else if (window.URL && args[0] && args[0] instanceof URL) {
    url = args[0].href
  }

  if (url) {
    this.parsedOrigin = parseUrl(url)
    this.sameOrigin = this.parsedOrigin.sameOrigin
  }

  var payload = generateTracePayload(this.parsedOrigin)
  if (!payload || (!payload.newrelicHeader && !payload.traceContextParentHeader)) {
    return
  }

  if (typeof args[0] === 'string' || (window.URL && args[0] && args[0] instanceof URL)) {
    var clone = {}

    for (var key in opts) {
      clone[key] = opts[key]
    }

    clone.headers = new Headers(opts.headers || {})
    if (addHeaders(clone.headers, payload)) {
      this.dt = payload
    }

    if (args.length > 1) {
      args[1] = clone
    } else {
      args.push(clone)
    }
  } else if (args[0] && args[0].headers) {
    if (addHeaders(args[0].headers, payload)) {
      this.dt = payload
    }
  }

  function addHeaders(headersObj, payload) {
    var added = false
    if (payload.newrelicHeader) {
      headersObj.set('newrelic', payload.newrelicHeader)
      added = true
    }
    if (payload.traceContextParentHeader) {
      headersObj.set('traceparent', payload.traceContextParentHeader)
      if (payload.traceContextStateHeader) {
        headersObj.set('tracestate', payload.traceContextStateHeader)
      }
      added = true
    }
    return added
  }
})

// Create report for XHR request that has finished
function end (xhr) {
  var params = this.params
  var metrics = this.metrics

  if (this.ended) return
  this.ended = true

  for (var i = 0; i < handlersLen; i++) {
    xhr.removeEventListener(handlers[i], this.listener, false)
  }

  if (params.aborted) return
  metrics.duration = loader.now() - this.startTime
  if (!this.loadCaptureCalled && xhr.readyState === 4) {
    captureXhrData(this, xhr)
  } else if (params.status == null) {
    params.status = 0
  }

  // Always send cbTime, even if no noticeable time was taken.
  metrics.cbTime = this.cbTime
  ee.emit('xhr-done', [xhr], xhr)
  handle('xhr', [params, metrics, this.startTime])
}

function addUrl (ctx, url) {
  var parsed = parseUrl(url)
  var params = ctx.params

  params.host = parsed.hostname + ':' + parsed.port
  params.pathname = parsed.pathname
  ctx.parsedOrigin = parseUrl(url)
  ctx.sameOrigin = ctx.parsedOrigin.sameOrigin
}

function captureXhrData (ctx, xhr) {
  ctx.params.status = xhr.status

  var size = responseSizeFromXhr(xhr, ctx.lastSize)
  if (size) ctx.metrics.rxSize = size

  if (ctx.sameOrigin) {
    var header = xhr.getResponseHeader('X-NewRelic-App-Data')
    if (header) {
      ctx.params.cat = header.split(', ').pop()
    }
  }

  ctx.loadCaptureCalled = true
}

},{}],10:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var stringsToParsedUrls = {}

module.exports = function parseUrl (url) {
  if (url in stringsToParsedUrls) {
    return stringsToParsedUrls[url]
  }

  var urlEl = document.createElement('a')
  var location = window.location
  var ret = {}

  // Use an anchor dom element to resolve the url natively.
  urlEl.href = url

  ret.port = urlEl.port

  var firstSplit = urlEl.href.split('://')

  if (!ret.port && firstSplit[1]) {
    ret.port = firstSplit[1].split('/')[0].split('@').pop().split(':')[1]
  }
  if (!ret.port || ret.port === '0') ret.port = (firstSplit[0] === 'https' ? '443' : '80')

  // Host not provided in IE for relative urls
  ret.hostname = (urlEl.hostname || location.hostname)

  ret.pathname = urlEl.pathname

  ret.protocol = firstSplit[0]

  // Pathname sometimes doesn't have leading slash (IE 8 and 9)
  if (ret.pathname.charAt(0) !== '/') ret.pathname = '/' + ret.pathname

  // urlEl.protocol is ':' in old ie when protocol is not specified
  var sameProtocol = !urlEl.protocol || urlEl.protocol === ':' || urlEl.protocol === location.protocol
  var sameDomain = urlEl.hostname === document.domain && urlEl.port === location.port

  // urlEl.hostname is not provided by IE for relative urls, but relative urls are also same-origin
  ret.sameOrigin = sameProtocol && (!urlEl.hostname || sameDomain)

  // Only cache if url doesn't have a path
  if (ret.pathname === '/') {
    stringsToParsedUrls[url] = ret
  }

  return ret
}

},{}],11:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var dataSize = require(14)

module.exports = responseSizeFromXhr

function responseSizeFromXhr (xhr, lastSize) {
  var type = xhr.responseType
  if (type === 'json' && lastSize !== null) return lastSize
  // Caution! Chrome throws an error if you try to access xhr.responseText for binary data
  if (type === 'arraybuffer' || type === 'blob' || type === 'json') {
    return dataSize(xhr.response)
  } else if (type === 'text' || type === '' || type === undefined) {  // empty string type defaults to 'text'
    return dataSize(xhr.responseText)
  } else {  // e.g. ms-stream and document (we do not currently determine the size of Document objects)
    return undefined
  }
}

},{}],12:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var handle = require("handle")
var mapOwn = require(22)
var slice = require(23)
var tracerEE = require("ee").get('tracer')
var loader = require("loader")

var nr = NREUM
if (typeof (window.newrelic) === 'undefined') newrelic = nr

var asyncApiFns = [
  'setPageViewName',
  'setCustomAttribute',
  'setErrorHandler',
  'finished',
  'addToTrace',
  'inlineHit',
  'addRelease'
]

var prefix = 'api-'
var spaPrefix = prefix + 'ixn-'

// Setup stub functions that queue calls for later processing.
mapOwn(asyncApiFns, function (num, fnName) {
  nr[fnName] = apiCall(prefix + fnName, true, 'api')
})

nr.addPageAction = apiCall(prefix + 'addPageAction', true)
nr.setCurrentRouteName = apiCall(prefix + 'routeName', true)

module.exports = newrelic

nr.interaction = function () {
  return new InteractionHandle().get()
}

function InteractionHandle () {}

var InteractionApiProto = InteractionHandle.prototype = {
  createTracer: function (name, cb) {
    var contextStore = {}
    var ixn = this
    var hasCb = typeof cb === 'function'
    handle(spaPrefix + 'tracer', [loader.now(), name, contextStore], ixn)
    return function () {
      tracerEE.emit((hasCb ? '' : 'no-') + 'fn-start', [loader.now(), ixn, hasCb], contextStore)
      if (hasCb) {
        try {
          return cb.apply(this, arguments)
        } catch (err) {
          tracerEE.emit('fn-err', [arguments, this, err], contextStore)
          // the error came from outside the agent, so don't swallow
          throw err
        } finally {
          tracerEE.emit('fn-end', [loader.now()], contextStore)
        }
      }
    }
  }
}

mapOwn('actionText,setName,setAttribute,save,ignore,onEnd,getContext,end,get'.split(','), function addApi (n, name) {
  InteractionApiProto[name] = apiCall(spaPrefix + name)
})

function apiCall (name, notSpa, bufferGroup) {
  return function () {
    handle(name, [loader.now()].concat(slice(arguments)), notSpa ? null : this, bufferGroup)
    return notSpa ? void 0 : this
  }
}

newrelic.noticeError = function (err, customAttributes) {
  if (typeof err === 'string') err = new Error(err)
  handle('err', [err, loader.now(), false, customAttributes])
}

},{}],13:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  getConfiguration: getConfiguration
}

function getConfiguration(path) {
  if (!NREUM.init) return
  var val = NREUM.init
  var parts = path.split('.')
  for (var i = 0; i < parts.length - 1; i++) {
    val = val[parts[i]]
    if (typeof val !== 'object') return
  }
  val = val[parts[parts.length - 1]]
  return val
}

},{}],14:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = function dataSize (data) {
  if (typeof data === 'string' && data.length) return data.length
  if (typeof data !== 'object') return undefined
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer && data.byteLength) return data.byteLength
  if (typeof Blob !== 'undefined' && data instanceof Blob && data.size) return data.size
  if (typeof FormData !== 'undefined' && data instanceof FormData) return undefined

  try {
    return JSON.stringify(data).length
  } catch (e) {
    return undefined
  }
}

},{}],15:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ffVersion = 0
var match = navigator.userAgent.match(/Firefox[\/\s](\d+\.\d+)/)
if (match) ffVersion = +match[1]

module.exports = ffVersion

},{}],16:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var lastTimestamp = new Date().getTime()
var offset = lastTimestamp

var performanceCheck = require(24)

module.exports = now
module.exports.offset = offset
module.exports.getLastTimestamp = getLastTimestamp

function now () {
  if (performanceCheck.exists && performance.now) {
    return Math.round(performance.now())
  }
  // ensure a new timestamp is never smaller than a previous timestamp
  return (lastTimestamp = Math.max(new Date().getTime(), lastTimestamp)) - offset
}

function getLastTimestamp() {
  return lastTimestamp
}

},{}],17:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = protocolAllowed

function protocolAllowed (location) {
  return !!(location && location.protocol && location.protocol !== 'file:')
}

},{}],18:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// collect page view timings unless the feature is explicitly disabled
if ('init' in NREUM && 'page_view_timing' in NREUM.init &&
  'enabled' in NREUM.init.page_view_timing &&
  NREUM.init.page_view_timing.enabled === false) {
  return
}

var handle = require("handle")
var loader = require("loader")
var subscribeToVisibilityChange = require(21)

var origEvent = NREUM.o.EV

// paint metrics
function perfObserver(list, observer) {
  var entries = list.getEntries()
  entries.forEach(function (entry) {
    if (entry.name === 'first-paint') {
      handle('timing', ['fp', Math.floor(entry.startTime)])
    } else if (entry.name === 'first-contentful-paint') {
      handle('timing', ['fcp', Math.floor(entry.startTime)])
    }
  })
}

// largest contentful paint
function lcpObserver(list, observer) {
  var entries = list.getEntries()
  if (entries.length > 0) {
    handle('lcp', [entries[entries.length - 1]])
  }
}

function clsObserver(list) {
  list.getEntries().forEach(function(entry) {
    if (!entry.hadRecentInput) {
      handle('cls', [entry])
    }
  })
}

var performanceObserver
var lcpPerformanceObserver
var clsPerformanceObserver
if ('PerformanceObserver' in window && typeof window.PerformanceObserver === 'function') {
  // passing in an unknown entry type to observer could throw an exception
  performanceObserver = new PerformanceObserver(perfObserver) // eslint-disable-line no-undef
  try {
    performanceObserver.observe({entryTypes: ['paint']})
  } catch (e) {}

  lcpPerformanceObserver = new PerformanceObserver(lcpObserver) // eslint-disable-line no-undef
  try {
    lcpPerformanceObserver.observe({entryTypes: ['largest-contentful-paint']})
  } catch (e) {}

  clsPerformanceObserver = new PerformanceObserver(clsObserver) // eslint-disable-line no-undef
  try {
    clsPerformanceObserver.observe({type: 'layout-shift', buffered: true})
  } catch (e) {}
}

// first interaction and first input delay
if ('addEventListener' in document) {
  var fiRecorded = false
  var allowedEventTypes = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchstart']
  allowedEventTypes.forEach(function (e) {
    document.addEventListener(e, captureInteraction, false)
  })
}

function captureInteraction(evt) {
  if (evt instanceof origEvent && !fiRecorded) {
    var fi = Math.round(evt.timeStamp)
    var attributes = {
      type: evt.type
    }

    // The value of Event.timeStamp is epoch time in some old browser, and relative
    // timestamp in newer browsers. We assume that large numbers represent epoch time.
    if (fi <= loader.now()) {
      attributes['fid'] = loader.now() - fi
    } else if (fi > loader.offset && fi <= Date.now()) {
      fi = fi - loader.offset
      attributes['fid'] = loader.now() - fi
    } else {
      fi = loader.now()
    }

    fiRecorded = true
    handle('timing', ['fi', fi, attributes])
  }
}

// page visibility events
subscribeToVisibilityChange(captureVisibilityChange)

function captureVisibilityChange(state) {
  handle('pageHide', [loader.now(), state])
}

},{}],19:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  generateUuid: generateUuid,
  generateSpanId: generateSpanId,
  generateTraceId: generateTraceId
}

function generateUuid () {
  var randomVals = null
  var rvIndex = 0
  var crypto = window.crypto || window.msCrypto
  if (crypto && crypto.getRandomValues) {
    randomVals = crypto.getRandomValues(new Uint8Array(31))
  }

  function getRandomValue () {
    if (randomVals) {
      // same as % 16
      return randomVals[rvIndex++] & 15
    } else {
      return Math.random() * 16 | 0
    }
  }

  // v4 UUID
  var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  var id = ''
  var c
  for (var i = 0; i < template.length; i++) {
    c = template[i]
    if (c === 'x') {
      id += getRandomValue().toString(16)
    } else if (c === 'y') {
      // this is the uuid variant per spec (8, 9, a, b)
      // % 4, then shift to get values 8-11
      c = getRandomValue() & 0x3 | 0x8
      id += c.toString(16)
    } else {
      id += c
    }
  }

  return id
}

// 16-character hex string (per DT spec)
function generateSpanId () {
  return generateRandomHexString(16)
}

// 32-character hex string (per DT spec)
function generateTraceId() {
  return generateRandomHexString(32)
}

function generateRandomHexString(length) {
  var randomVals = null
  var rvIndex = 0
  var crypto = window.crypto || window.msCrypto
  if (crypto && crypto.getRandomValues && Uint8Array) {
    randomVals = crypto.getRandomValues(new Uint8Array(31))
  }

  var chars = []
  for (var i = 0; i < length; i++) {
    chars.push(getRandomValue().toString(16))
  }
  return chars.join('')

  function getRandomValue () {
    if (randomVals) {
      // same as % 16
      return randomVals[rvIndex++] & 15
    } else {
      return Math.random() * 16 | 0
    }
  }
}

},{}],20:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Feature-detection is much preferred over using User Agent to detect browser.
// However, there are cases where feature detection is not possible, for example
// when a specific version of a browser has a bug that requires a workaround in just
// that version.
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#Browser_Name
var agentName = null
var agentVersion = null
var safari = /Version\/(\S+)\s+Safari/

if (navigator.userAgent) {
  var userAgent = navigator.userAgent
  var parts = userAgent.match(safari)

  if (parts && userAgent.indexOf('Chrome') === -1 &&
      userAgent.indexOf('Chromium') === -1) {
    agentName = 'Safari'
    agentVersion = parts[1]
  }
}

module.exports = {
  agent: agentName,
  version: agentVersion,
  match: match
}

function match (name, version) {
  if (!agentName) {
    return false
  }

  if (name !== agentName) {
    return false
  }

  // version not provided, only match by name
  if (!version) {
    return true
  }

  // version provided, but not detected - not reliable match
  if (!agentVersion) {
    return false
  }

  var detectedParts = agentVersion.split('.')
  var requestedParts = version.split('.')
  for (var i = 0; i < requestedParts.length; i++) {
    if (requestedParts[i] !== detectedParts[i]) {
      return false
    }
  }

  return true
}

},{}],21:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = subscribeToVisibilityChange

var hidden, eventName, state

if (typeof document.hidden !== 'undefined') {
  hidden = 'hidden'
  eventName = 'visibilitychange'
  state = 'visibilityState'
} else if (typeof document.msHidden !== 'undefined') {
  hidden = 'msHidden'
  eventName = 'msvisibilitychange'
} else if (typeof document.webkitHidden !== 'undefined') {
  hidden = 'webkitHidden'
  eventName = 'webkitvisibilitychange'
  state = 'webkitVisibilityState'
}

function subscribeToVisibilityChange(cb) {
  if ('addEventListener' in document && eventName) {
    document.addEventListener(eventName, handleVisibilityChange, false)
  }

  function handleVisibilityChange() {
    if (state && document[state]) {
      cb(document[state])
    } else if (document[hidden]) {
      cb('hidden')
    } else {
      cb('visible')
    }
  }
}

},{}],22:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var has = Object.prototype.hasOwnProperty

module.exports = mapOwn

function mapOwn (obj, fn) {
  var results = []
  var key = ''
  var i = 0

  for (key in obj) {
    if (has.call(obj, key)) {
      results[i] = fn(key, obj[key])
      i += 1
    }
  }

  return results
}

},{}],23:[function(require,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="npm" -o ./npm/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */

/**
 * Slices the `collection` from the `start` index up to, but not including,
 * the `end` index.
 *
 * Note: This function is used instead of `Array#slice` to support node lists
 * in IE < 9 and to ensure dense arrays are returned.
 *
 * @private
 * @param {Array|Object|string} collection The collection to slice.
 * @param {number} start The start index.
 * @param {number} end The end index.
 * @returns {Array} Returns the new array.
 */
function slice(array, start, end) {
  start || (start = 0);
  if (typeof end == 'undefined') {
    end = array ? array.length : 0;
  }
  var index = -1,
      length = end - start || 0,
      result = Array(length < 0 ? 0 : length);

  while (++index < length) {
    result[index] = array[start + index];
  }
  return result;
}

module.exports = slice;

},{}],24:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  exists: typeof (window.performance) !== 'undefined' && window.performance.timing && typeof (window.performance.timing.navigationStart) !== 'undefined'
}

},{}],"ee":[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ctxId = 'nr@context'
var getOrSet = require("gos")
var mapOwn = require(22)

var eventBuffer = {}
var emitters = {}

var baseEE = module.exports = ee()
module.exports.getOrSetContext = getOrSetContext

baseEE.backlog = eventBuffer

function EventContext () {}

function ee (old) {
  var handlers = {}
  var bufferGroupMap = {}

  var emitter = {
    on: addEventListener,
    addEventListener: addEventListener,
    removeEventListener: removeEventListener,
    emit: emit,
    get: getOrCreate,
    listeners: listeners,
    context: context,
    buffer: bufferEventsByGroup,
    abort: abortIfNotLoaded,
    aborted: false
  }

  return emitter

  function context (contextOrStore) {
    if (contextOrStore && contextOrStore instanceof EventContext) {
      return contextOrStore
    } else if (contextOrStore) {
      return getOrSet(contextOrStore, ctxId, getNewContext)
    } else {
      return getNewContext()
    }
  }

  function emit (type, args, contextOrStore, force, bubble) {
    if (bubble !== false) bubble = true
    if (baseEE.aborted && !force) { return }
    if (old && bubble) old(type, args, contextOrStore)

    var ctx = context(contextOrStore)
    var handlersArray = listeners(type)
    var len = handlersArray.length

    // Extremely verbose debug logging
    // if ([/^xhr/].map(function (match) {return type.match(match)}).filter(Boolean).length) {
    //  console.log(type + ' args:')
    //  console.log(args)
    //  console.log(type + ' handlers array:')
    //  console.log(handlersArray)
    //  console.log(type + ' context:')
    //  console.log(ctx)
    //  console.log(type + ' ctxStore:')
    //  console.log(ctxStore)
    // }

    // Apply each handler function in the order they were added
    // to the context with the arguments

    for (var i = 0; i < len; i++) handlersArray[i].apply(ctx, args)

    // Buffer after emitting for consistent ordering
    var bufferGroup = eventBuffer[bufferGroupMap[type]]
    if (bufferGroup) {
      bufferGroup.push([emitter, type, args, ctx])
    }

    // Return the context so that the module that emitted can see what was done.
    return ctx
  }

  function addEventListener (type, fn) {
    // Retrieve type from handlers, if it doesn't exist assign the default and retrieve it.
    handlers[type] = listeners(type).concat(fn)
  }

  function removeEventListener (type, fn) {
    var listeners = handlers[type]
    if (!listeners) return
    for (var i = 0; i < listeners.length; i++) {
      if (listeners[i] === fn) {
        listeners.splice(i, 1)
      }
    }
  }

  function listeners (type) {
    return handlers[type] || []
  }

  function getOrCreate (name) {
    return (emitters[name] = emitters[name] || ee(emit))
  }

  function bufferEventsByGroup (types, group) {
    mapOwn(types, function (i, type) {
      group = group || 'feature'
      bufferGroupMap[type] = group
      if (!(group in eventBuffer)) {
        eventBuffer[group] = []
      }
    })
  }
}

// get context object from store object, or create if does not exist
function getOrSetContext(obj) {
  return getOrSet(obj, ctxId, getNewContext)
}

function getNewContext () {
  return new EventContext()
}

// abort should be called 30 seconds after the page has started running
// We should drop our data and stop collecting if we still have a backlog, which
// signifies the rest of the agent wasn't loaded
function abortIfNotLoaded () {
  if (eventBuffer.api || eventBuffer.feature) {
    baseEE.aborted = true
    eventBuffer = baseEE.backlog = {}
  }
}

},{}],"gos":[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var has = Object.prototype.hasOwnProperty

module.exports = getOrSet

// Always returns the current value of obj[prop], even if it has to set it first
function getOrSet (obj, prop, getVal) {
  // If the value exists return it.
  if (has.call(obj, prop)) return obj[prop]

  var val = getVal()

  // Attempt to set the property so it's not enumerable
  if (Object.defineProperty && Object.keys) {
    try {
      Object.defineProperty(obj, prop, {
        value: val, // old IE inherits non-write-ability
        writable: true,
        enumerable: false
      })

      return val
    } catch (e) {
      // Can't report internal errors,
      // because GOS is a dependency of the reporting mechanisms
    }
  }

  // fall back to setting normally
  obj[prop] = val
  return val
}

},{}],"handle":[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ee = require("ee").get('handle')

// Exported for register-handler to attach to.
module.exports = handle
handle.ee = ee

function handle (type, args, ctx, group) {
  ee.buffer([type], group)
  ee.emit(type, args, ctx)
}

},{}],"id":[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Start assigning ids at 1 so 0 can always be used for window, without
// actually setting it (which would create a global variable).
var index = 1
var prop = 'nr@id'
var getOrSet = require("gos")

module.exports = id

// Always returns id of obj, may tag obj with an id in the process.
function id (obj) {
  var type = typeof obj
  // We can only tag objects, functions, and arrays with ids.
  // For all primitive values we instead return -1.
  if (!obj || !(type === 'object' || type === 'function')) return -1
  if (obj === window) return 0

  return getOrSet(obj, prop, function () { return index++ })
}

},{}],"loader":[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var now = require(16)
var handle = require("handle")
var mapOwn = require(22)
var ee = require("ee")
var userAgent = require(20)
var protocolAllowed = require(17)
var config = require(13)

var scheme = (config.getConfiguration('ssl') === false) ? 'http' : 'https'

var win = window
var doc = win.document

var ADD_EVENT_LISTENER = 'addEventListener'
var ATTACH_EVENT = 'attachEvent'
var XHR = win.XMLHttpRequest
var XHR_PROTO = XHR && XHR.prototype

var disabled = !protocolAllowed(win.location)

NREUM.o = {
  ST: setTimeout,
  SI: win.setImmediate,
  CT: clearTimeout,
  XHR: XHR,
  REQ: win.Request,
  EV: win.Event,
  PR: win.Promise,
  MO: win.MutationObserver
}

var origin = '' + location
var defInfo = {
  beacon: 'bam.nr-data.net',
  errorBeacon: 'bam.nr-data.net',
  agent: 'js-agent.newrelic.com/nr.js'
}

var xhrWrappable = XHR &&
  XHR_PROTO &&
  XHR_PROTO[ADD_EVENT_LISTENER] &&
  !/CriOS/.test(navigator.userAgent)

var exp = module.exports = {
  offset: now.getLastTimestamp(),
  now: now,
  origin: origin,
  features: {},
  xhrWrappable: xhrWrappable,
  userAgent: userAgent,
  disabled: disabled
}

if (!protocolAllowed(win.location)) return

// api loads registers several event listeners, but does not have any exports
require(12)

// paint timings
require(18)

if (doc[ADD_EVENT_LISTENER]) {
  doc[ADD_EVENT_LISTENER]('DOMContentLoaded', loaded, false)
  win[ADD_EVENT_LISTENER]('load', windowLoaded, false)
} else {
  doc[ATTACH_EVENT]('onreadystatechange', stateChange)
  win[ATTACH_EVENT]('onload', windowLoaded)
}

handle('mark', ['firstbyte', now.getLastTimestamp()], null, 'api')

var loadFired = 0
function windowLoaded () {
  if (loadFired++) return
  var info = exp.info = NREUM.info

  var firstScript = doc.getElementsByTagName('script')[0]
  setTimeout(ee.abort, 30000)

  if (!(info && info.licenseKey && info.applicationID && firstScript)) {
    return ee.abort()
  }

  mapOwn(defInfo, function (key, val) {
    // this will overwrite any falsy value in config
    // This is intentional because agents may write an empty string to
    // the agent key in the config, in which case we want to use the default
    if (!info[key]) info[key] = val
  })

  var ts = now()
  handle('mark', ['onload', ts + exp.offset], null, 'api')
  handle('timing', ['load', ts])

  var agent = doc.createElement('script')
  agent.src = scheme + '://' + info.agent
  firstScript.parentNode.insertBefore(agent, firstScript)
}

function stateChange () {
  if (doc.readyState === 'complete') loaded()
}

function loaded () {
  handle('mark', ['domContent', now() + exp.offset], null, 'api')
}

},{}],"wrap-function":[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var ee = require("ee")
var slice = require(23)
var flag = 'nr@original'
var has = Object.prototype.hasOwnProperty
var inWrapper = false

module.exports = createWrapperWithEmitter
module.exports.wrapFunction = wrapFunction
module.exports.wrapInPlace = wrapInPlace
module.exports.argsToArray = argsToArray

function createWrapperWithEmitter(emitter, always) {
  emitter || (emitter = ee)

  wrapFn.inPlace = inPlace
  wrapFn.flag = flag

  return wrapFn

  function wrapFn (fn, prefix, getContext, methodName, bubble) {
    // Unless fn is both wrappable and unwrapped, return it unchanged.
    if (notWrappable(fn)) return fn

    if (!prefix) prefix = ''

    nrWrapper[flag] = fn
    copy(fn, nrWrapper, emitter)
    return nrWrapper

    function nrWrapper () {
      var args
      var originalThis
      var ctx
      var result

      try {
        originalThis = this
        args = slice(arguments)

        if (typeof getContext === 'function') {
          ctx = getContext(args, originalThis)
        } else {
          ctx = getContext || {}
        }
      } catch (e) {
        report([e, '', [args, originalThis, methodName], ctx], emitter)
      }

      // Warning: start events may mutate args!
      safeEmit(prefix + 'start', [args, originalThis, methodName], ctx, bubble)

      try {
        result = fn.apply(originalThis, args)
        return result
      } catch (err) {
        safeEmit(prefix + 'err', [args, originalThis, err], ctx, bubble)

        // rethrow error so we don't effect execution by observing.
        throw err
      } finally {
        // happens no matter what.
        safeEmit(prefix + 'end', [args, originalThis, result], ctx, bubble)
      }
    }
  }

  function inPlace (obj, methods, prefix, getContext, bubble) {
    if (!prefix) prefix = ''
    // If prefix starts with '-' set this boolean to add the method name to
    // the prefix before passing each one to wrap.
    var prependMethodPrefix = (prefix.charAt(0) === '-')
    var fn
    var method
    var i

    for (i = 0; i < methods.length; i++) {
      method = methods[i]
      fn = obj[method]

      // Unless fn is both wrappable and unwrapped bail,
      // so we don't add extra properties with undefined values.
      if (notWrappable(fn)) continue

      obj[method] = wrapFn(fn, (prependMethodPrefix ? method + prefix : prefix), getContext, method, bubble)
    }
  }

  function safeEmit (evt, arr, store, bubble) {
    if (inWrapper && !always) return
    var prev = inWrapper
    inWrapper = true
    try {
      emitter.emit(evt, arr, store, always, bubble)
    } catch (e) {
      report([e, evt, arr, store], emitter)
    }
    inWrapper = prev
  }
}

function report (args, emitter) {
  emitter || (emitter = ee)
  try {
    emitter.emit('internal-error', args)
  } catch (err) {}
}

function copy (from, to, emitter) {
  if (Object.defineProperty && Object.keys) {
    // Create accessors that proxy to actual function
    try {
      var keys = Object.keys(from)
      keys.forEach(function (key) {
        Object.defineProperty(to, key, {
          get: function () { return from[key] },
          set: function (val) { from[key] = val; return val }
        })
      })
      return to
    } catch (e) {
      report([e], emitter)
    }
  }
  // fall back to copying properties
  for (var i in from) {
    if (has.call(from, i)) {
      to[i] = from[i]
    }
  }
  return to
}

function notWrappable (fn) {
  return !(fn && fn instanceof Function && fn.apply && !fn[flag])
}

function wrapFunction(fn, wrapper) {
  var wrapped = wrapper(fn)
  wrapped[flag] = fn
  copy(fn, wrapped, ee)
  return wrapped
}

function wrapInPlace(obj, fnName, wrapper) {
  var fn = obj[fnName]
  obj[fnName] = wrapFunction(fn, wrapper)
}

function argsToArray() {
  var len = arguments.length
  var arr = new Array(len)
  for (var i = 0; i < len; ++i) {
    arr[i] = arguments[i]
  }
  return arr
}

},{}]},{},["loader",2,9])

