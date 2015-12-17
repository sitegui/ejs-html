'use strict'

module.exports.compile = require('./lib/compile')
module.exports.escape = require('./lib/escape')
module.exports.parse = require('./lib/parse')
module.exports.reduce = require('./lib/reduce')

/**
 * @param {string} source
 * @param {Object} [locals={}]
 * @param {Object} [options]
 * @param {boolean} [options.debug=false]
 * @param {string} [options.filename='ejs']
 * @param {boolean} [options.standAlone=false]
 */
module.exports.render = function (source, locals, options) {
	return module.exports.compile(source, options)(locals)
}