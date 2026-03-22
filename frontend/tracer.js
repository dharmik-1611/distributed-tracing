// MUST be the very first require in your app — before express, axios, anything
'use strict'
const tracer = require('dd-trace').init({
  logInjection: true,   // injects dd.trace_id and dd.span_id into every log
  analytics: true,
})
module.exports = tracer
