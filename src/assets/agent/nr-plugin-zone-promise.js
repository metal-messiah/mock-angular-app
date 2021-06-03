// prelude.js edited from: https://github.com/substack/browser-pack/blob/master/prelude.js

// modules are defined as an array
// [ module function, map of requires ]
//
// map of requireuires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, cache, entry) { // eslint-disable-line no-extra-parens
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof __nr_require === 'function' && __nr_require

  function newRequire (name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof __nr_require === 'function' && __nr_require
        if (!jumped && currentRequire) return currentRequire(name, true)

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) return previousRequire(name, true)
        throw new Error("Cannot find module '" + name + "'")
      }
      var m = cache[name] = {exports: {}}
      modules[name][0].call(m.exports, function (x) {
        var id = modules[name][1][x]
        return newRequire(id || x)
      }, m, m.exports)
    }
    return cache[name].exports
  }
  for (var i = 0; i < entry.length; i++) newRequire(entry[i])

  // Override the current require with this new one
  return newRequire
})
({1:[function(require,module,exports){
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var handle = require("handle")
var frameworksEE = require("ee").get('frameworks')
var promiseWrapper = require("wrap-function")(frameworksEE)

var api = null
var instrumented = false

// register itself with the SPA feature
handle('spa-register', [init])

function init(pluginApi) {
  if (!pluginApi) return
  api = pluginApi
  instrument()
}

window.addEventListener('DOMContentLoaded', function () {
  instrument()
})

function instrument() {
  if (instrumented) return
  wrapZonePromise()
}

function wrapZonePromise() {
  // instrument Zone.js promise
  if (window.Promise.toString().indexOf('ZoneAwarePromise') > -1) {
    promiseWrapper.inPlace(window.Promise.prototype, ['then'], 'zonepromise-then-', getPromise)
    instrumented = true
  }
}

function getPromise (args, originalThis) {
  return originalThis
}

// handle wrapped function events
frameworksEE.on('zonepromise-then-start', function (args, originalThis) {
  if (!api) return
  var currentNode = api.getCurrentNode()
  if (currentNode) {
    this.promise = originalThis
    this.spaNode = currentNode

    if (typeof args[0] === 'function') {
      args[0] = promiseWrapper(args[0], 'zonepromise-cb-', this)
    }
    if (typeof args[1] === 'function') {
      args[1] = promiseWrapper(args[1], 'zonepromise-cb-', this)
    }
  }
})

frameworksEE.on('zonepromise-cb-start', function(args) {
  if (!api) return
  if (this.spaNode) {
    this.prevNode = api.getCurrentNode()
    api.setCurrentNode(this.spaNode)
  }
})

frameworksEE.on('zonepromise-cb-end', function(args) {
  if (!api) return
  if (this.spaNode) {
    api.setCurrentNode(this.prevNode)
  }
})

},{}]},{},[1])

