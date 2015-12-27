/*jshint evil:true*/
'use strict'

let escape = require('./escape'),
	parse = require('./parse'),
	getSnippet = require('./getSnippet'),
	reduce

/**
 * Prepare render source for stand-alone function
 * @var {string}
 */
let standAloneRenderCode = render.toString()

// Remove function signature and closing '}'
standAloneRenderCode = standAloneRenderCode
	.substring(standAloneRenderCode.indexOf('\n') + 1, standAloneRenderCode.length - 2)

// Add stand-alone versions of escapeHTML
standAloneRenderCode = `var escapeHTML = ${escape.html.standAlone.toString()}
${standAloneRenderCode}`

/**
 * A function that may transform the parsed tree before the compilation continues.
 * This should return a new array of tokens or `undefined` to use the same (in case
 * of in-place changes)
 * @callback TransformerFn
 * @param {Array<Token>} tokens
 * @returns {?Array<Token>}
 */

/**
 * @param {string} source
 * @param {Object} [options]
 * @param {boolean} [options.debug=false]
 * @param {string} [options.filename='ejs']
 * @param {boolean} [options.standAlone=false]
 * @param {TransformerFn} [options.transformer]
 * @returns {function(Object):string}
 */
module.exports = function (source, options) {
	options = options || {}

	// Parse
	let tokens = parse(source)

	// Transform
	if (options.transformer) {
		tokens = options.transformer(tokens) || tokens
	}

	let reducedTokens = reduce(tokens),
		jsCode = createCode(reducedTokens),
		escapeHTML = escape.html,
		filename = options.filename || 'ejs',
		internalRender

	if (options.debug) {
		console.log(jsCode)
	}

	if (options.standAlone) {
		// internalRender, source, filename
		let standAloneCode = `var internalRender = function (locals, __escape, __line) {
			${jsCode}
		}
		var source = "${escape.js(source)}"
		var filename = "${escape.js(filename)}"
		var getSnippet = ${getSnippet}
		${standAloneRenderCode}`
		return new Function('locals, renderCustom', standAloneCode)
	}

	try {
		internalRender = new Function('locals, __escape, __line, __renderCustom', jsCode)
	} catch (e) {
		e.message += ` (in ${filename}, while compiling ejs)`
		throw e
	}

	return function (locals, renderCustom) {
		return render(locals, escapeHTML, renderCustom, internalRender, source, filename)
	}
}

reduce = require('./reduce')

/**
 * Create the JS for the body of a function that will render the HTML content
 * @param {Array<Token|string>} tokens
 * @returns {string}
 */
function createCode(tokens) {
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
		code += `\n__line.start = ${token.start.line};\n__line.end = ${token.end.line};`
	}
}

module.exports.createCode = createCode

/**
 * @param {Object} locals
 * @param {function(string):string} escapeHTML
 * @param {Function} renderCustom
 * @param {Function} internalRender
 * @param {string} source
 * @param {string} filename
 * @returns {string}
 */
function render(locals, escapeHTML, renderCustom, internalRender, source, filename) {
	/*jshint esnext:false*/
	var line = {
		start: 0,
		end: 0
	}
	try {
		return internalRender(locals, escapeHTML, line, renderCustom)
	} catch (err) {
		var snippet = getSnippet(source, line.start, line.end)
		err.path = filename
		err.message = filename + ':' +
			line.start + '\n' + snippet + '\n\n' + err.message
		throw err
	}
}