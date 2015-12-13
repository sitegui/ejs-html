'use strict'

// Match the start of the next non-text token
let nonTextStartRegex = /<(!DOCTYPE |!--|%=|%-|%(?!%)|\/|(?!%%))/g,
	// Match the end of the current ejs-* token
	ejsEndRegex = /%>/g,
	// Match the end of the current doctype or close-tag
	tagEndRegex = />/g,
	// Match the end of the current comment tag
	commentEndRegex = /-->/g,
	// Valid tag names
	tagNameRegex = /^([a-z][^\s\/>]*)$/i,
	// Find the last position of the current tag name
	tagNameEndRegex = /(?=[\s\/>])/g,
	// Find the next start of attribute, ejs or tag end
	tagOpenContentStartRegex = /^\s*(<%=|<%(?!%)|>|\/>|[^\s\/>"'<=]+)/,
	// Match static attribute values, or the start of a dynamic quoted one
	// This can generate false negatives, for example, in:
	// '="a<b" >' even tough the value is fixed (no ejs), will be read as a dynamic one
	// But this will be fixed by inspecting the we only got one text part
	attributeValueRegex = /^\s*=\s*("|'|[^\s>"'<=`]*|"[^"<]*"|'[^'<]*')/,
	// Find the next start of ejs in attribute value or its end
	nonTextValueStartDoubleRegex = /<%=|<%(?!%)|"/g,
	nonTextValueStartSingleRegex = /<%=|<%(?!%)|'/g,
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
 * @property {string} type - one of: simple-attribute, attribute, ejs-escaped, ejs-eval
 * @property {?string} name - present for types: simple-attribute, attribute
 * @property {?string} value - Empty string if a boolean attribute. Present for type: simple-attribute
 * @property {?string} content - present for types: ejs-escaped, ejs-eval
 * @property {?Array<ValuePart>} parts - present for type: attribute
 */

/**
 * @typedef {Object} ValuePart
 * @property {string} type - one of: text, ejs-escaped
 * @property {string} content
 */

/**
 * @param {string} source
 * @returns {Array<Token>}
 */
module.exports = function parse(source) {
	let pos = 0,
		line = 1,
		column = 1,
		tokens = []

	while (true) {
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
			throw new SyntaxError(`Unterminated ${type}`)
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
		let token = readSimpleToken('tag-close', tagEndRegex)
		if (!tagNameRegex.test(token.name)) {
			throw new SyntaxError(`Invalid tag name: ${token.name}`)
		}
		return {
			type: 'tag-close',
			start: token.start,
			end: token.end,
			name: token.content
		}
	}

	/**
	 * Read an open tag token
	 * @returns {Token}
	 */
	function readOpenTag() {
		// Read tag name
		let nameToken = readSimpleToken('tag-open', tagNameEndRegex)
		if (!tagNameRegex.test(nameToken.content)) {
			throw new SyntaxError(`Invalid tag name: ${nameToken.content}`)
		}

		// Keep reading content
		let selfClose = false,
			attributes = []
		while (true) {
			// Match using anchored regex
			let match = tagOpenContentStartRegex.exec(source.substr(pos))
			if (!match) {
				throw new SyntaxError('Invalid open tag')
			}

			advanceTo(pos + match[0].length)
			if (match[1] === '<%=') {
				attributes.push(readSimpleToken('ejs-escaped', ejsEndRegex))
			} else if (match[1] === '<%') {
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
			start: nameToken.start,
			end: getSourcePoint(),
			name: nameToken.content,
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
		let match = attributeValueRegex.exec(source.substr(pos))

		if (match) {
			advanceTo(pos + match[0].length)
			if (match[1] === '"' || match[1] === '\'') {
				// Quoted value
				let parts = readValueParts(match[1])
				if (parts.length === 1 && parts[0].type === 'text') {
					// A simple quoted value that appeared not to be
					// Example: 'attr="a<b"'
					// Since the regex optimizes for quoted values without '<' 
					return {
						type: 'simple-attribute',
						name: name,
						value: parts[0].content
					}
				}
				return {
					type: 'attribute',
					name: name,
					parts: parts
				}
			}
		}

		// Missing, unquoted or simple quote value
		return {
			type: 'simple-attribute',
			name: name,
			value: (match && match[1]) || ''
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
				throw new SyntaxError('Invalid quoted attribute value')
			}

			if (match.index !== pos) {
				// Emit text
				parts.push({
					type: 'text',
					content: source.substring(pos, match.index)
				})
			}

			advanceTo(regex.lastIndex)
			if (match[0] === '<%=') {
				parts.push(readSimpleToken('ejs-escaped', ejsEndRegex))
			} else if (match[0] === '<%') {
				tokens.push(readSimpleToken('ejs-eval', ejsEndRegex))
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
}