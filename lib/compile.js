'use strict'

let escape = require('./escape'),
	parse = require('./parse'),
	getSnippet = require('./getSnippet'),
	prepareOptions = require('./prepareOptions'),
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
 * @param {Object} [options] - see {@link prepareOptions}
 * @returns {Render}
 */
module.exports = function (source, options) {
	options = prepareOptions(options)

	let jsCode = prepareInternalJSCode(source, options)

	let internalRender
	try {
		// eslint-disable-next-line no-new-func
		internalRender = new Function('locals, renderCustom, __e, __l', jsCode)
	} catch (e) {
		e.message += ` (in ${options.filename}, while compiling ejs)`
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
			err.path = options.filename
			err.message = `${options.filename}:${line.s}\n${snippet}\n\n${err.message}`
			throw err
		}
	}
}

/**
 * Much like {@link compile}, but returns a stand-alone JS source code,
 * that can be exported to another JS VM. When there, turn this into a function
 * with: render = new Function('locals, renderCustom', returnedCode)
 * @param {string} source
 * @param {Object} [options] - see {@link prepareOptions}
 * @returns {string}
 */
module.exports.standAlone = function (source, options) {
	options = prepareOptions(options)

	let jsCode = prepareInternalJSCode(source, options)

	if (!options.compileDebug) {
		// No special exception handling
		return `let __e = ${escape.html.standAloneCode};
${jsCode}`
	}

	return `let __e = ${escape.html.standAloneCode},
__gS = ${getSnippet.toString()},
__l = {s: 0, e: 0},
__s = "${escape.js(source)}";
try {
${jsCode}
} catch (__x) {
	let __snippet = __gS(__s, __l.s, __l.e);
	__x.path = "${escape.js(options.filename)}";
	__x.message = "${escape.js(options.filename)}:" + __l.s + "\\n" +
		__snippet + "\\n\\n" +
		__x.message;
	throw __x;
}`
}

/**
 * Common logic for `compile` and `compile.standAlone`
 * @private
 * @param {string} source
 * @param {Object} options - already prepared
 * @returns {Render}
 */
function prepareInternalJSCode(source, options) {
	// Parse
	let tokens = parse(source)

	// Transform
	if (options.transformer) {
		tokens = options.transformer(tokens) || tokens
	}

	let reducedTokens = reduce(tokens, options),
		jsCode = createCode(reducedTokens, options, false)

	return jsCode
}

reduce = require('./reduce')

/**
 * Create the JS for the body of a function that will render the HTML content
 * @param {Array<Token|string>} tokens
 * @param {Object} options - already prepared
 * @param {boolean} asInnerExpression - whether to return code to be used inside a parent createCode() context
 * @returns {string}
 */
function createCode(tokens, options, asInnerExpression) {
	if (!tokens.length || (tokens.length === 1 && typeof tokens[0] === 'string')) {
		// Special case for static string
		return `${asInnerExpression ? '' : 'return'}"${escape.js(tokens[0] || '')}"`
	}

	let hasStatements = tokens.some(t => typeof t === 'object' && t.type === 'ejs-eval'),
		code = ''

	// Current print position for an expression, possible values for hasStatements:
	//
	// let __o = <very-first> + <rest>;
	// // some code
	// __o += <first> + <rest>;
	//
	// Possible values for !hasStatements:
	// return <very-first> + <rest>;
	let state = 'very-first'

	// Prepare header
	if (!asInnerExpression) {
		if (options.strictMode) {
			code += '"use strict";'
		}
		code += 'locals=locals||{};let __c=locals.__contents||{};'
		if (!options.strictMode) {
			code += 'with(locals){'
		}
		if (options.vars.length) {
			code += 'let ' +
				options.vars.map(each => `${each}=locals.${each}`).join(',') + ';'
		}
	}
	if (hasStatements) {
		// We'll need a temporary variable to hold the output generated so far
		if (asInnerExpression) {
			// Wrap in an immediate-invocated function
			code += '(function(){'
		}
		code += 'let __o='
	} else if (!asInnerExpression) {
		code += 'return '
	}

	// Prepare body
	for (let i = 0, len = tokens.length; i < len; i++) {
		let token = tokens[i]

		if (typeof token === 'string') {
			appendExpression(`"${escape.js(token)}"`, true, null)
		} else if (token.type === 'ejs-eval') {
			appendStatement(token.content.trim(), token)
		} else if (token.type === 'ejs-escaped') {
			appendExpression(`__e(${token.content.trim()})`, true, token)
		} else if (token.type === 'ejs-raw') {
			appendExpression(`(${token.content.trim()})`, false, token)
		}
	}

	// Prepare footer
	if (state === 'rest' && !asInnerExpression) {
		code += ';'
	}
	if (hasStatements) {
		code += 'return __o;'
		if (asInnerExpression) {
			code += '})()'
		}
	}
	if (!asInnerExpression && !options.strictMode) {
		code += '}' // close with(locals)
	}
	return code

	/**
	 * Append an expression that contributes directly to the output
	 * @param {string} exp
	 * @param {boolean} isString - whether this expression certainly evaluates to a string
	 * @param {?Token} token
	 */
	function appendExpression(exp, isString, token) {
		if (state === 'very-first') {
			if (!isString) {
				code += '""+'
			}
		} else if (state === 'first') {
			code += '__o+='
		} else {
			code += '+'
		}

		if (options.compileDebug && token) {
			code += `(${getDebugMarker(token)},${exp})`
		} else {
			code += exp
		}

		state = 'rest'
	}

	/**
	 * Append statements that do not produce output directly
	 * (This won't be called if !hasStatements)
	 * @param {string} st
	 * @param {?Token} token
	 */
	function appendStatement(st, token) {
		if (state === 'very-first') {
			code += '"";'
		} else if (state === 'rest') {
			code += ';'
		}

		if (options.compileDebug && token) {
			code += `${getDebugMarker(token)};`
		}
		code += `${st}\n`

		state = 'first'
	}
}

/**
 * @private
 */
module.exports._createCode = createCode

/**
 * @param {Token} token
 * @returns {string} - a JS expression
 * @private
 */
function getDebugMarker(token) {
	let start = token.start.line,
		end = token.end.line
	if (start === end) {
		return `__l.s=__l.e=${end}`
	}
	return `__l.s=${start},__l.e=${end}`
}

/**
 * @private
 */
module.exports._getDebugMarker = getDebugMarker