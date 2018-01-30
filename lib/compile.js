'use strict'

let escape = require('./escape'),
	parse = require('./parse'),
	getSnippet = require('./getSnippet'),
	prepareOptions = require('./prepareOptions'),
	sourceBuilder = require('./sourceBuilder'),
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

	let builder = prepareInternalJSCode(source, options)

	if (options.strictMode) {
		builder.prepend('"use strict";')
	}

	let {
		code,
		map,
		mapWithCode
	} = builder.build(source)

	let internalRender
	try {
		// eslint-disable-next-line no-new-func
		internalRender = new Function('locals, renderCustom, __e, __l', code)
	} catch (e) {
		e.message += ` (in ${options.filename}, while compiling ejs)`
		throw e
	}

	let fn
	if (!options.compileDebug) {
		// No special exception handling
		fn = function (locals, renderCustom) {
			return internalRender(locals, renderCustom, escape.html)
		}
	} else {
		fn = function (locals, renderCustom) {
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

	if (options.sourceMap) {
		fn.code = code
		fn.map = map
		fn.mapWithCode = mapWithCode
	}

	return fn
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
	return module.exports.standAloneAsObject(source, options).code
}

/**
 * Much like {@link compile}, but returns a stand-alone JS source code,
 * that can be exported to another JS VM. When there, turn this into a function
 * with: render = new Function('locals, renderCustom', returnedCode)
 * @param {string} source
 * @param {Object} [options] - see {@link prepareOptions}
 * @returns {{code: string, map: ?string, mapWithCode: ?string}}
 */
module.exports.standAloneAsObject = function (source, options) {
	options = prepareOptions(options)

	let subBuilder = prepareInternalJSCode(source, options),
		builder = sourceBuilder(options)

	if (options.strictMode) {
		builder.add('"use strict";')
	}

	if (!options.compileDebug) {
		// No special exception handling
		builder.add(`${escape.html.standAloneCode}\n`)
		builder.addBuilder(subBuilder)
	} else {
		builder.add(`${escape.html.standAloneCode}\n`)
		builder.add(`let __gS=${getSnippet.min.toString()},__l={s:0,e:0},__s="${escape.js(source)}";`)
		builder.add('try {')
		builder.addBuilder(subBuilder)
		builder.add('}catch(e){')
		builder.add('let s=__gS(__s,__l.s,__l.e);')
		builder.add(`e.path="${escape.js(options.filename)}";`)
		builder.add(`e.message="${escape.js(options.filename)}:"+__l.s+"\\n"+s+"\\n\\n"+e.message;`)
		builder.add('throw e;')
		builder.add('}')
	}

	return builder.build(source)
}

/**
 * Common logic for `compile` and `compile.standAlone`
 * @private
 * @param {string} source
 * @param {Object} options - already prepared
 * @returns {SourceBuilder}
 */
function prepareInternalJSCode(source, options) {
	// Parse
	let tokens = parse(source)

	// Transform
	if (options.transformer) {
		tokens = options.transformer(tokens) || tokens
	}

	let reducedTokens = reduce(tokens, options)

	return createCode(reducedTokens, options, false)
}

reduce = require('./reduce')

/**
 * Create the JS for the body of a function that will render the HTML content
 * @param {Array<Token|string>} tokens
 * @param {Object} options - already prepared
 * @param {boolean} asInnerExpression - whether to return code to be used inside a parent createCode() context
 * @returns {SourceBuilder}
 */
function createCode(tokens, options, asInnerExpression) {
	let builder = sourceBuilder(options)

	if (!tokens.length || (tokens.length === 1 && typeof tokens[0] === 'string')) {
		// Special case for static string
		builder.add(`${asInnerExpression ? '' : 'return'}"${escape.js(tokens[0] || '')}"`)
		return builder
	}

	let hasStatements = tokens.some(t => typeof t === 'object' && t.type === 'ejs-eval')

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
		builder.add('locals=locals||{};let __c=locals.__contents||{};')
		if (!options.strictMode) {
			builder.add('with(locals){')
		}
		if (options.vars.length) {
			builder.add('let ' +
				options.vars.map(each => `${each}=locals.${each}`).join(',') + ';')
		}
	}
	if (hasStatements) {
		// We'll need a temporary variable to hold the output generated so far
		if (asInnerExpression) {
			// Wrap in an immediate-invocated function
			builder.add('(function(){')
		}
		builder.add('let __o=')
	} else if (!asInnerExpression) {
		builder.add('return ')
	}

	// Prepare body
	for (let i = 0, len = tokens.length; i < len; i++) {
		let token = tokens[i]

		if (typeof token === 'string') {
			appendExpression(`"${escape.js(token)}"`, null, null, true)
		} else if (token.type === 'ejs-eval') {
			appendStatement(token)
		} else if (token.type === 'ejs-escaped') {
			appendExpression('__e(', token, ')', true)
		} else if (token.type === 'ejs-raw') {
			appendExpression('(', token, ')', false)
		} else if (token.type === 'source-builder') {
			appendExpression('(', token, ')', false)
		}
	}

	// Prepare footer
	if (state === 'rest' && (!asInnerExpression || hasStatements)) {
		builder.add(';')
	}
	if (hasStatements) {
		builder.add('return __o;')
		if (asInnerExpression) {
			builder.add('})()')
		}
	}
	if (!asInnerExpression && !options.strictMode) {
		builder.add('}') // close with(locals)
	}
	return builder

	/**
	 * Append an expression that contributes directly to the output
	 * @param {?string} prefix
	 * @param {?Token|SourceBuilder} token
	 * @param {?string} suffix
	 * @param {boolean} isString - whether this expression certainly evaluates to a string
	 */
	function appendExpression(prefix, token, suffix, isString) {
		if (state === 'very-first') {
			if (!isString) {
				builder.add('""+')
			}
		} else if (state === 'first') {
			builder.add('__o+=')
		} else {
			builder.add('+')
		}

		if (options.compileDebug && token) {
			builder.add(`(${getDebugMarker(token)},`)
		}
		if (prefix) {
			builder.add(prefix)
		}
		if (token) {
			if (token.type === 'source-builder') {
				builder.addBuilder(token.sourceBuilder)
			} else {
				builder.addToken(token)
			}
		}
		if (suffix) {
			builder.add(suffix)
		}
		if (options.compileDebug && token) {
			builder.add(')')
		}

		state = 'rest'
	}

	/**
	 * Append statements that do not produce output directly
	 * (This won't be called if !hasStatements)
	 * @param {Token} token
	 */
	function appendStatement(token) {
		if (state === 'very-first') {
			builder.add('"";')
		} else if (state === 'rest') {
			builder.add(';')
		}

		if (options.compileDebug) {
			builder.add(`${getDebugMarker(token)};`)
		}
		if (token.type === 'source-builder') {
			builder.addBuilder(token.sourceBuilder)
		} else {
			builder.addToken(token)
		}
		builder.add('\n')

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