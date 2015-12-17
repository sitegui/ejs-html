'use strict'

// Match the start of the next non-text token
let nonTextStartRegex = /<(!DOCTYPE |!--|%=|%-|%(?!%)|\/|(?!%%))/g,
	// Match the end of the current ejs-* token
	ejsEndRegex = /%>/g,
	// Match the end of the current doctype or close-tag
	tagEndRegex = />/g,
	// Match the end of the current comment tag
	commentEndRegex = /-->/g,
	// Match the closing tag
	tagCloseRegex = /^([a-z][^\s\/>]*)\s*>/i,
	// Valid tag names
	tagNameRegex = /^[a-z][^\s\/>]*/i,
	// Find the next start of attribute, ejs or tag end
	tagOpenContentStartRegex = /^\s*(<%=|<%-|<%(?!%)|>|\/>|[^\s\/>"'<=]+)/,
	// Match static attribute values, or the start of a dynamic quoted one
	// This can generate false negatives, for example, in:
	// '="a<b" >' even tough the value is fixed (no ejs), will be read as a dynamic one
	// But this will be fixed by inspecting the we only got one text part
	attributeValueRegex = /^\s*=\s*("|'|[^\s>"'<=`]+|"[^"<]*"|'[^'<]*')/,
	// Find the next start of ejs in attribute value or its end
	nonTextValueStartDoubleRegex = /<%=|<%-|<%(?!%)|"/g,
	nonTextValueStartSingleRegex = /<%=|<%-|<%(?!%)|'/g,
	assert = require('assert')

/**
 * @typedef {Object} Token
 * @property {string} type - one of: text, ejs-eval, ejs-escaped, ejs-raw, comment, tag-close, doctype, tag-open
 * @property {SourcePoint} start - inclusive
 * @property {SourcePoint} end - non inclusive
 * @property {?string} content - present for types: text, ejs-eval, ejs-escaped, ejs-raw, comment, doctype
 * @property {?string} name - present for types: tag-close, tag-open
 * @property {?boolean} selfClose - present for type: tag-open
 * @property {?Array<Attribute>} attributes - present for type: tag-open
 */

/**
 * @typedef {Object} SourcePoint
 * @property {number} pos - zero-indexed position in the original source
 * @property {number} line - one-indexed
 * @property {number} column - one-indexed
 */

/**
 * @typedef {Object} Attribute
 * @property {string} type - one of: attribute-simple, attribute, ejs-escaped, ejs-eval
 * @property {?string} name - present for types: attribute-simple, attribute
 * @property {?string} value - Empty string if a boolean attribute. Present for type: attribute-simple
 * @property {?string} quote - used value quote (either empty, ' or "). Present for types: attribute-simple, attribute
 * @property {?string} content - present for types: ejs-escaped, ejs-eval
 * @property {?Array<ValuePart>} parts - present for type: attribute
 * @property {SourcePoint} start - inclusive. Present for types: ejs-escaped, ejs-eval
 * @property {SourcePoint} end - non inclusive. Present for types: ejs-escaped, ejs-eval
 */

/**
 * @typedef {Object} ValuePart
 * @property {string} type - one of: text, ejs-escaped, ejs-eval
 * @property {string} content
 * @property {SourcePoint} start - inclusive. Present for types: ejs-escaped, ejs-eval
 * @property {SourcePoint} end - non inclusive. Present for types: ejs-escaped, ejs-eval
 */

/**
 * @param {string} source
 * @param {Object} [options]
 * @param {boolean} [allowEJSInOpenTags=false]
 * @returns {Array<Token>}
 */
module.exports = function parse(source, options) {
	let pos = 0,
		line = 1,
		column = 1,
		tokens = []

	options = options || {}

	while (pos < source.length) {
		let match = exec(nonTextStartRegex)

		if (!match) {
			// All remaining is text
			let start = getSourcePoint()
			advanceTo(source.length)
			tokens.push(createContentToken('text', start))
			break
		}

		if (match.index !== pos) {
			// Emit text
			let start = getSourcePoint()
			advanceTo(match.index)
			tokens.push(createContentToken('text', start))
		}

		advanceTo(nonTextStartRegex.lastIndex)
		if (match[1] === '!DOCTYPE ') {
			tokens.push(readSimpleToken('doctype', tagEndRegex))
		} else if (match[1] === '!--') {
			tokens.push(readSimpleToken('comment', commentEndRegex))
		} else if (match[1] === '%=') {
			tokens.push(readSimpleToken('ejs-escaped', ejsEndRegex))
		} else if (match[1] === '%-') {
			tokens.push(readSimpleToken('ejs-raw', ejsEndRegex))
		} else if (match[1] === '%') {
			tokens.push(readSimpleToken('ejs-eval', ejsEndRegex))
		} else if (match[1] === '/') {
			tokens.push(readCloseTag())
		} else if (match[1] === '') {
			tokens.push(readOpenTag())
		}
	}

	return tokens

	/**
	 * Read a single token that has a known end
	 * @param {string} type
	 * @param {RegExp} endRegex
	 * @returns {Token}
	 */
	function readSimpleToken(type, endRegex) {
		let match = exec(endRegex)
		if (!match) {
			throwSyntaxError(`Unterminated ${type}`)
		}
		let start = getSourcePoint()
		advanceTo(match.index)
		let token = createContentToken(type, start)
		advanceTo(endRegex.lastIndex)
		return token
	}

	/**
	 * Read a close tag token
	 * @returns {Token}
	 */
	function readCloseTag() {
		let start = getSourcePoint(),
			match = tagCloseRegex.exec(source.substr(pos))
		if (!match) {
			throwSyntaxError('Invalid close tag')
		}
		advanceTo(pos + match[1].length)
		let end = getSourcePoint()
		advanceTo(pos - match[1].length + match[0].length)
		return {
			type: 'tag-close',
			start,
			end,
			name: match[1]
		}
	}

	/**
	 * Read an open tag token
	 * @returns {Token}
	 */
	function readOpenTag() {
		// Read tag name
		let start = getSourcePoint(),
			match = tagNameRegex.exec(source.substr(pos))
		if (!match) {
			throwSyntaxError('Invalid open tag')
		}
		let tagName = match[0]
		advanceTo(pos + tagName.length)

		// Keep reading content
		let selfClose = false,
			attributes = []
		while (true) {
			// Match using anchored regex
			let match = tagOpenContentStartRegex.exec(source.substr(pos))
			if (!match) {
				throwSyntaxError('Invalid open tag')
			}

			advanceTo(pos + match[0].length)
			if (match[1] === '<%-') {
				throwSyntaxError('EJS unescaped tags are not allowed here')
			} else if (match[1] === '<%=') {
				if (!options.allowEJSInOpenTags) {
					throwSyntaxError('EJS escaped tags are not allowed here')
				}
				attributes.push(readSimpleToken('ejs-escaped', ejsEndRegex))
			} else if (match[1] === '<%') {
				if (!options.allowEJSInOpenTags) {
					throwSyntaxError('EJS eval tags are not allowed here')
				}
				attributes.push(readSimpleToken('ejs-eval', ejsEndRegex))
			} else if (match[1] === '>') {
				break
			} else if (match[1] === '/>') {
				selfClose = true
				break
			} else {
				// Attribute start
				attributes.push(readAttribute(match[1]))
			}
		}

		return {
			type: 'tag-open',
			start: start,
			end: getSourcePoint(),
			name: tagName,
			selfClose: selfClose,
			attributes: attributes
		}
	}

	/**
	 * @param {string} name
	 * @returns {Attribute}
	 */
	function readAttribute(name) {
		// Read value (anchored match)
		let match = attributeValueRegex.exec(source.substr(pos)),
			quote = ''

		if (match) {
			// The quote used quote is the first char in the matched value
			quote = match[1][0]
			if (quote !== '"' && quote !== '\'') {
				// Unquoted value
				quote = ''
			}

			advanceTo(pos + match[0].length)
			if (match[1] === '"' || match[1] === '\'') {
				// Quoted value
				let parts = readValueParts(match[1])
				if (!parts.length || (parts.length === 1 && parts[0].type === 'text')) {
					// A simple quoted value that appeared not to be
					// Example: 'attr="a<b"'
					// Since the regex optimizes for quoted values without '<' 
					return {
						type: 'attribute-simple',
						name: name,
						value: parts.length ? parts[0].content : '',
						quote: quote
					}
				}
				return {
					type: 'attribute',
					name: name,
					parts: parts,
					quote: quote
				}
			}
		}

		// Missing, unquoted or simple quote value
		return {
			type: 'attribute-simple',
			name: name,
			value: (match && match[1]) || '',
			quote: quote
		}
	}

	/**
	 * @param {string} q - one of: ', "
	 * @returns {Array<ValueParts>}
	 */
	function readValueParts(q) {
		let regex = q === '"' ? nonTextValueStartDoubleRegex : nonTextValueStartSingleRegex,
			parts = []
		while (true) {
			let match = exec(regex)
			if (!match) {
				throwSyntaxError('Invalid quoted attribute value')
			}

			if (match.index !== pos) {
				// Emit text
				parts.push({
					type: 'text',
					content: source.substring(pos, match.index)
				})
			}

			advanceTo(regex.lastIndex)
			if (match[0] === '<%-') {
				throwSyntaxError('Invalid quoted attribute value')
			} else if (match[0] === '<%=') {
				parts.push(readSimpleToken('ejs-escaped', ejsEndRegex))
			} else if (match[0] === '<%') {
				parts.push(readSimpleToken('ejs-eval', ejsEndRegex))
			} else {
				// End quote
				return parts
			}
		}
	}

	/**
	 * Advance reading position, updating `pos`, `line` and `column`
	 * @param {number} newPos - must be greater or equal to current pos
	 */
	function advanceTo(newPos) {
		let n = newPos - pos
		assert(n >= 0)
		while (n--) {
			if (source[pos] === '\n') {
				column = 1
				line++
			} else {
				column++
			}
			pos += 1
		}
	}

	/**
	 * Execute a regex from the current position
	 * @param {RegExp} regex
	 * @returns {?Array}
	 */
	function exec(regex) {
		regex.lastIndex = pos
		return regex.exec(source)
	}

	/**
	 * Return current source position
	 * @returns {SourcePoint}
	 */
	function getSourcePoint() {
		return {
			pos: pos,
			line: line,
			column: column
		}
	}

	/**
	 * Create a simple, content-oriented token up to current position
	 * @param {string} type - one of: text, ejs-eval, ejs-escaped, ejs-raw, comment, doctype
	 * @param {SourcePoint} start
	 * @returns {Token}
	 */
	function createContentToken(type, start) {
		let end = getSourcePoint()
		return {
			type,
			start,
			end,
			content: source.substring(start.pos, end.pos)
		}
	}

	/**
	 * Throw a syntax error in the current position
	 * @param {string} message
	 * @throws {SyntaxError}
	 */
	function throwSyntaxError(message) {
		let lines = source.split('\n'),
			curr = getSourcePoint(),
			fromLine = Math.max(1, curr.line - 2) - 1,
			toLine = Math.min(lines.length, curr.line + 2),
			snippet = lines.slice(fromLine, toLine).map((line, i) => {
				let lineNum = i + 1 + fromLine
				if (lineNum === curr.line) {
					return ` ${lineNum}\t >> | ${line}`
				}
				return ` ${lineNum}\t    | ${line}`
			}).join('\n')
		let err = new SyntaxError(`${message}\n${snippet}`)
		err.pos = getSourcePoint()
		throw err
	}
}