/*
 * Copyright 2015-2016 the original author or authors
 * @license MIT, see LICENSE.txt for details
 *
 * @author Scott Andrews
 */

'use strict'

var uriEncoder = require('./uriEncoder')

var prefixRE = /^([^:]*):([0-9]+)$/
var operations = {
  '': { first: '', separator: ',', named: false, empty: '', encoder: uriEncoder.encode },
  '+': { first: '', separator: ',', named: false, empty: '', encoder: uriEncoder.encodeURL },
  '#': { first: '#', separator: ',', named: false, empty: '', encoder: uriEncoder.encodeURL },
  '.': { first: '.', separator: '.', named: false, empty: '', encoder: uriEncoder.encode },
  '/': { first: '/', separator: '/', named: false, empty: '', encoder: uriEncoder.encode },
  ';': { first: ';', separator: ';', named: true, empty: '', encoder: uriEncoder.encode },
  '?': { first: '?', separator: '&', named: true, empty: '=', encoder: uriEncoder.encode },
  '&': { first: '&', separator: '&', named: true, empty: '=', encoder: uriEncoder.encode },
  '=': { reserved: true },
  ',': { reserved: true },
  '!': { reserved: true },
  '@': { reserved: true },
  '|': { reserved: true }
}

function apply (operation, expression, params) {
  var params = expression.split(',').reduce(function (result, variable) {
    var opts = {}
    var objectValue
    if (variable.slice(-1) === '*') {
      variable = variable.slice(0, -1)
      opts.explode = true
    }
    if (prefixRE.test(variable)) {
      var prefix = prefixRE.exec(variable)
      variable = prefix[1]
      opts.maxLength = parseInt(prefix[2])
    }

    variable = uriEncoder.decode(variable)
    var value = params[variable]

    if (value === void 0 || value === null) {
      return result
    }
    if (Array.isArray(value)) {
      result.push(value.reduce(function (result, value) {
        if (result.length) {
          result += opts.explode ? operation.separator : ','
          if (operation.named && opts.explode) {
            result += operation.encoder(variable)
            result += value.length ? '=' : operation.empty
          }
        } else if (operation.named) {
          result += operation.encoder(variable)
          result += value.length ? '=' : operation.empty
        }
        result += operation.encoder(value)
        return result
      }, ''))
    } else if (typeof value === 'object') {
      objectValue = Object.keys(value).reduce(function (result, name) {
        if (result.length) {
          result += opts.explode ? operation.separator : ','
        } else if (operation.named && !opts.explode) {
          result += operation.encoder(variable)
          result += value[name].length ? '=' : operation.empty
        }
        result += operation.encoder(name)
        result += opts.explode ? '=' : ','
        result += operation.encoder(value[name])
        return result
      }, '')
      if (objectValue) result.push(objectValue);
    } else {
      value = String(value)
      if (opts.maxLength) {
        value = value.slice(0, opts.maxLength)
      }
      if (operation.named) {
        result.push(operation.encoder(variable)
          + (value.length ? '=' : operation.empty)
          + operation.encoder(value)
        )
      } else {
        result.push(operation.encoder(value))
      }
    }

    return result
  }, [])

  return params.length ? operation.first + params.join(operation.separator) : ''
}

function expandExpression (expression, params) {
  var operation = operations[expression.slice(0, 1)]
  if (operation) {
    expression = expression.slice(1)
  } else {
    operation = operations['']
  }

  if (operation.reserved) {
    throw new Error('Reserved expression operations are not supported')
  }

  return apply(operation, expression, params)
}

function expandTemplate (template, params) {
  var uri = ''
  var end = 0
  var start
  while (true) {
    start = template.indexOf('{', end)
    if (start === -1) {
      // no more expressions
      uri += template.slice(end)
      break
    }
    uri += template.slice(end, start)
    end = template.indexOf('}', start) + 1
    uri += expandExpression(template.slice(start + 1, end - 1), params)
  }

  return uri
}

module.exports = {

  /**
   * Expand a URI Template with parameters to form a URI.
   *
   * Full implementation (level 4) of rfc6570.
   * @see https://tools.ietf.org/html/rfc6570
   *
   * @param {string} template URI template
   * @param {Object} [params] params to apply to the template durring expantion
   * @returns {string} expanded URI
   */
  expand: expandTemplate

}
