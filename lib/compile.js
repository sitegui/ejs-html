/*jshint evil:true*/
'use strict'

let escape = require('./escape'),
	parse = require('./parse'),
	reduce = require('./reduce')

/**
 * @param {string} source
 * @param {Object} [options]
 * @param {boolean} [options.debug=false]
 * @param {string} [options.filename='']
 * @param {boolean} [options.collapseText=false]
 * @param {boolean} [options.collapseAttribute=false]
 * @param {boolean} [options.boolAttribute=false]
 * @returns {function(Object):string}
 */
module.exports = function (source, options) {
	options = options || {}

	let tokens = parse(source),
		reducedTokens = reduce(tokens, options),
		jsCode = createCode(reducedTokens),
		render

	if (options.debug) {
		console.log(jsCode)
	}

	try {
		render = new Function('locals, __escape, __line', jsCode)
	} catch (e) {
		if (options.filename) {
			e.message += ` (in ${options.filename})`
		}
		e.message += ' (while compiling ejs)'
		throw e
	}

	return function (data) {
		var line = {
			start: 0,
			end: 0
		}
		try {
			return render(data, escape.html, line)
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

			err.path = options.filename
			err.message = (options.filename || 'ejs') + ':' +
				line.start + '\n' + snippet + '\n\n' + err.message
			throw err
		}
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