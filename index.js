'use strict'

module.exports.compile = require('./lib/compile')

/**
 * @param {string} source
 * @param {Object} [locals={}]
 * @param {Object} [options] - see {@link prepareOptions}
 * @returns {string}
 */
module.exports.render = function (source, locals, options) {
	return module.exports.compile(source, options)(locals)
}

// Utils
module.exports.parse = require('./lib/parse')
module.exports.reduce = require('./lib/reduce')
module.exports.escape = require('./lib/escape')
module.exports.getSnippet = require('./lib/getSnippet')

module.exports._prepareOptions = require('./lib/prepareOptions')