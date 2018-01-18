'use strict'

/**
 * @param {Object} [options={}]
 * @param {boolean} [options.compileDebug=true]
 * @param {string} [options.filename='ejs']
 * @param {TransformerFn} [options.transformer]
 * @param {boolean} [options.strictMode=true]
 * @param {Array<string>} [options.vars=[]]
 * @returns {Object}
 */
module.exports = function (options = {}) {
	if (options.compileDebug === undefined) {
		options.compileDebug = true
	}
	if (options.filename === undefined) {
		options.filename = 'ejs'
	}
	if (options.strictMode === undefined) {
		options.strictMode = true
	}
	if (options.vars === undefined) {
		options.vars = []
	}

	return options
}