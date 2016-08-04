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
 * @param {CustomRender} renderCustom
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
		internalRender = new Function('locals, renderCustom, __e, __l', jsCode)
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
			s: 0,
			e: 0
		}
		try {
			return internalRender(locals, renderCustom, escape.html, line)
		} catch (err) {
			let snippet = getSnippet(source, line.s, line.e)
			err.path = filename
			err.message = `${filename}:${line.s}\n${snippet}\n\n${err.message}`
			throw err
		}
	}
}

/**
 * Much like {@link compile}, but returns a stand-alone JS source code,
 * that can be exported to another JS VM. When there, turn this into a function
 * with: render = new Function('locals, renderCustom', returnedCode)
 * @returns {string}
 */
module.exports.standAlone = function (source, options) {
	options = options || {}

	let jsCode = prepareInternalJSCode(source, options),
		filename = options.filename || 'ejs'

	if (!options.compileDebug) {
		// No special exception handling
		return `var __e = ${escape.html.standAloneCode};
${jsCode}`
	}

	return `var __e = ${escape.html.standAloneCode},
__gS = ${getSnippet.toString()},
__l = {s: 0, e: 0},
__s = "${escape.js(source)}";
try {
${jsCode}
} catch (__x) {
	var __snippet = __gS(__s, __l.s, __l.e);
	__x.path = "${escape.js(filename)}";
	__x.message = "${escape.js(filename)}:" + __l.s + "\\n" +
		__snippet + "\\n\\n" +
		__x.message;
	throw __x;
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

	let reducedTokens = reduce(tokens, options.compileDebug),
		jsCode = createCode(reducedTokens, options.compileDebug, false)

	return jsCode
}

reduce = require('./reduce')

/**
 * Create the JS for the body of a function that will render the HTML content
 * @param {Array<Token|string>} tokens
 * @param {boolean} compileDebug - whether to include debug info that allows detailed stack
 * @param {boolean} reuseVars - whether to reuse vars added by a parent createCode() context
 * @returns {string}
 */
function createCode(tokens, compileDebug, reuseVars) {
	if (tokens.length === 1 && typeof tokens[0] === 'string') {
		// Special case for static string
		return `return "${escape.js(tokens[0])}"`
	}

	let code = 'var __o = "";'

	if (!reuseVars) {
		code += '\nlocals = locals || {};' +
			'\nvar __c = locals.__contents || {};' +
			'\nwith(locals) {'
	}

	let hasPendingExpression = false

	for (let i = 0, len = tokens.length; i < len; i++) {
		let token = tokens[i]

		if (typeof token === 'string') {
			appendExpression(`"${escape.js(token)}"`, null)
		} else if (token.type === 'ejs-eval') {
			appendStatement(token.content.trim(), token)
		} else if (token.type === 'ejs-escaped') {
			appendExpression(`__e(${token.content.trim()})`, token)
		} else if (token.type === 'ejs-raw') {
			appendExpression(token.content.trim(), token)
		}
	}

	if (!reuseVars) {
		appendStatement('}')
	}
	appendStatement('return __o;', null)
	return code

	/**
	 * Append an expression that contributes directly to the output
	 * @param {string} exp
	 * @param {?Token} token
	 */
	function appendExpression(exp, token) {
		if (!hasPendingExpression) {
			code += '\n__o += '
			hasPendingExpression = true
		} else {
			code += ' + '
		}

		if (compileDebug && token) {
			code += `(__l.s=${token.start.line},__l.e=${token.end.line},${exp})`
		} else {
			code += exp
		}
	}

	/**
	 * Append statements that do not produce output directly
	 * @param {string} st
	 * @param {?Token} token
	 */
	function appendStatement(st, token) {
		if (hasPendingExpression) {
			code += ';'
			hasPendingExpression = false
		}
		if (compileDebug && token) {
			code += `\n__l.s = ${token.start.line};\n__l.e = ${token.end.line};`
		}
		code += `\n${st}`
	}
}

module.exports.createCode = createCode