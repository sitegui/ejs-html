/*jshint evil:true*/
'use strict'

let escape = require('./escape'),
	parse = require('./parse'),
	reduce = require('./reduce')

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
 * @param {string} source
 * @param {Object} [options]
 * @param {boolean} [options.debug=false]
 * @param {string} [options.filename='ejs']
 * @param {boolean} [options.collapseText=false]
 * @param {boolean} [options.collapseAttribute=false]
 * @param {boolean} [options.boolAttribute=false]
 * @param {boolean} [options.standAlone=false]
 * @returns {function(Object):string}
 */
module.exports = function (source, options) {
	options = options || {}

	let tokens = parse(source, options),
		reducedTokens = reduce(tokens, options),
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
		${standAloneRenderCode}`
		return new Function('locals', standAloneCode)
	}

	try {
		internalRender = new Function('locals, __escape, __line', jsCode)
	} catch (e) {
		e.message += ` (in ${filename}, while compiling ejs)`
		throw e
	}

	return function (locals) {
		render(locals, internalRender, escapeHTML, source, filename)
	}
}

/**
 * Create the JS for the body of a function that will render the HTML content
 * @param {Array<Token|string>} tokens
 * @returns {string}
 */
function createCode(tokens) {
	let code = 'var __output = "";\nlocals = locals || {};\nwith(locals) {'

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

/**
 * @param {Object} locals
 * @param {function(string):string} escapeHTML
 * @param {Function} internalRender
 * @param {string} source
 * @param {string} filename
 * @returns {string}
 */
function render(locals, escapeHTML, internalRender, source, filename) {
	/*jshint esnext:false*/
	var line = {
		start: 0,
		end: 0
	}
	try {
		return internalRender(locals, escapeHTML, line)
	} catch (err) {
		var lines = source.split('\n'),
			fromLine = Math.max(1, line.start - 2) - 1,
			toLine = Math.min(lines.length, line.end + 2),
			snippet = lines.slice(fromLine, toLine).map(function (str, i) {
				if (i >= line.start - fromLine - 1 && i <= line.end - fromLine - 1) {
					return '\t >> | ' + str
				}
				return '\t    | ' + str
			}).join('\n')

		err.path = filename
		err.message = filename + ':' +
			line.start + '\n' + snippet + '\n\n' + err.message
		throw err
	}
}