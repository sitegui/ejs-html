'use strict'

let escape = require('./escape'),
	parse = require('./parse'),
	getSnippet = require('./getSnippet'),
	reduce

/**
 * A function that may transform the parsed tree before the compilation continues.
 * This should return a new array of tokens or `undefined` to use the same (in case
 * of in-place changes)
 * @callback TransformerFn
 * @param {Array<Token>} tokens
 * @returns {?Array<Token>}
 */

/**
 * @callback Render
 * @param {Object} locals
 * @param {CustomRender} customRender
 * @returns {string}
 */

/**
 * @callback CustomRender
 * @param {string} elementName
 * @param {Object} locals
 * @returns {string}
 */

/**
 * @param {string} source
 * @param {Object} [options]
 * @param {boolean} [options.compileDebug=true]
 * @param {string} [options.filename='ejs']
 * @param {TransformerFn} [options.transformer]
 * @returns {Render}
 */
module.exports = function (source, options) {
	options = options || {}

	let jsCode = prepareInternalJSCode(source, options),
		filename = options.filename || 'ejs'

	let internalRender
	try {
		/*jshint evil:true*/
		internalRender = new Function('locals, renderCustom, __escape, __line', jsCode)
	} catch (e) {
		e.message += ` (in ${filename}, while compiling ejs)`
		throw e
	}

	if (!options.compileDebug) {
		// No special exception handling
		return function (locals, renderCustom) {
			return internalRender(locals, renderCustom, escape.html)
		}
	}

	return function (locals, renderCustom) {
		let line = {
			start: 0,
			end: 0
		}
		try {
			return internalRender(locals, renderCustom, escape.html, line)
		} catch (err) {
			let snippet = getSnippet(source, line.start, line.end)
			err.path = filename
			err.message = `${filename}:${line.start}\n${snippet}\n\n${err.message}`
			throw err
		}
	}
}

/**
 * Much like {@link compile}, but returns a stand-alone JS source code,
 * that can be exported to another JS VM. When there, turn this into a function
 * with: render = new Function('locals, customRender', returnedCode)
 * @returns {string}
 */
module.exports.standAlone = function (source, options) {
	options = options || {}

	let jsCode = prepareInternalJSCode(source, options),
		filename = options.filename || 'ejs'

	if (!options.compileDebug) {
		// No special exception handling
		return `var __escape = ${escape.html.standAloneCode};
${jsCode}`
	}

	return `var __escape = ${escape.html.standAloneCode},
__getSnippet = ${getSnippet.toString()},
__line = {start: 0, end: 0},
__source = "${escape.js(source)}";
try {
${jsCode}
} catch (__err) {
	var __snippet = __getSnippet(__source, __line.start, __line.end);
	__err.path = "${escape.js(filename)}";
	__err.message = "${escape.js(filename)}:" + __line.start + "\\n" +
		__snippet + "\\n\\n" +
		__err.message;
	throw __err;
}`
}

/**
 * Common logic for `compile` and `compile.standAlone`
 * @private
 * @param {string} source
 * @param {Object} options
 * @param {TransformerFn} [options.transformer]
 * @param {boolean} [options.compileDebug=true]
 * @returns {Render}
 */
function prepareInternalJSCode(source, options) {
	if (options.compileDebug === undefined) {
		options.compileDebug = true
	}

	// Parse
	let tokens = parse(source)

	// Transform
	if (options.transformer) {
		tokens = options.transformer(tokens) || tokens
	}

	let reducedTokens = reduce(tokens),
		jsCode = createCode(reducedTokens, options.compileDebug)

	return jsCode
}

reduce = require('./reduce')

/**
 * Create the JS for the body of a function that will render the HTML content
 * @param {Array<Token|string>} tokens
 * @param {boolean} compileDebug - whether to include debug info that allows detailed stack
 * @returns {string}
 */
function createCode(tokens, compileDebug) {
	let code = `var __output = "";
locals = locals || {};
__contents = locals.__contents || {};
with(locals) {`

	for (let i = 0, len = tokens.length; i < len; i++) {
		let token = tokens[i]

		if (typeof token === 'string') {
			code += `\n__output += "${escape.js(token)}";`
		} else if (token.type === 'ejs-eval') {
			appendPosition(token)
			code += `\n${token.content}`
		} else if (token.type === 'ejs-escaped') {
			appendPosition(token)
			code += `\n__output += __escape(${token.content});`
		} else if (token.type === 'ejs-raw') {
			appendPosition(token)
			code += `\n__output += (${token.content});`
		}
	}

	code += '\n}\nreturn __output;'
	return code

	function appendPosition(token) {
		if (compileDebug) {
			code += `\n__line.start = ${token.start.line};\n__line.end = ${token.end.line};`
		}
	}
}

module.exports.createCode = createCode