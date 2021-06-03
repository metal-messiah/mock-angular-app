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

var handle = require("handle")
var mapOwn = require(8)
var slice = require(9)
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

},{}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var lastTimestamp = new Date().getTime()
var offset = lastTimestamp

var performanceCheck = require(10)

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

},{}],4:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = protocolAllowed

function protocolAllowed (location) {
  return !!(location && location.protocol && location.protocol !== 'file:')
}

},{}],5:[function(require,module,exports){
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
var subscribeToVisibilityChange = require(7)

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

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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
var mapOwn = require(8)

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

var now = require(3)
var handle = require("handle")
var mapOwn = require(8)
var ee = require("ee")
var userAgent = require(6)
var protocolAllowed = require(4)
var config = require(2)

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
require(1)

// paint timings
require(5)

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
var slice = require(9)
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

},{}]},{},["loader"])

