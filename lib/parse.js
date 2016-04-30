'use strict'

// Match the start of the next non-text token
let nonTextStartRegex = /<(!DOCTYPE |!--|%=|%-|%(?!%)|\/|(?!%%))/ig,
	// Match the start of the next non-text token when inside a special element
	// (an special element may contain anything, up to a matching closing tag
	nonSpecialTextStartRegex = {
		script: /<(%=|%-|%(?!%)|\/(?=script\s*>))/ig,
		style: /<(%=|%-|%(?!%)|\/(?=style\s*>))/ig
	},
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
	// Known boolean attributes
	booleanAttributeRegex = /^(allowfullscreen|async|autofocus|autoplay|checked|compact|controls|declare|default|defaultchecked|defaultmuted|defaultselected|defer|disabled|enabled|formnovalidate|hidden|indeterminate|inert|ismap|itemscope|loop|multiple|muted|nohref|noresize|noshade|novalidate|nowrap|open|pauseonexit|readonly|required|reversed|scoped|seamless|selected|sortable|spellcheck|truespeed|typemustmatch|visible)$/,
	// Known void elements (elements that must have no content)
	voidElementsRegex = /^(area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/,
	assert = require('assert'),
	getSnippet = require('./getSnippet')

/**
 * @typedef {Object} Token
 * @property {string} type - one of: text, ejs-eval, ejs-escaped, ejs-raw, comment, doctype, element
 * @property {SourcePoint} start - inclusive
 * @property {SourcePoint} end - non inclusive
 * @property {?string} content - present for types: text, ejs-eval, ejs-escaped, ejs-raw, comment, doctype
 * @property {?string} name - present for type: element
 * @property {?boolean} isVoid - whether this is a void element, present for type: element
 * @property {?Array<Attribute>} attributes - present for type: element
 * @property {?Array<Token>} children - present for type: element
 */

/**
 * @typedef {Object} SourcePoint
 * @property {number} pos - zero-indexed position in the original source
 * @property {number} line - one-indexed
 * @property {number} column - one-indexed
 */

/**
 * @typedef {Object} Attribute
 * @property {string} type - one of: attribute-simple, attribute
 * @property {string} name
 * @property {boolean} isBoolean - whether this is a boolean attribute
 * @property {string} quote - used value quote (either empty, ' or ")
 * @property {?string} value - Empty string if a boolean attribute. Present for type: attribute-simple
 * @property {?Array<ValuePart>} parts - present for type: attribute
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
 * @returns {Array<Token>}
 */
module.exports = function parse(source) {
	let pos = 0,
		line = 1,
		column = 1,
		rootTokens = [],
		tokens = rootTokens,
		elementsStack = [],
		// Keep the name of the current special element we are in
		specialElement = ''

	while (true) {
		let regex = specialElement ? nonSpecialTextStartRegex[specialElement] : nonTextStartRegex,
			match = exec(regex)

		if (!match) {
			// All remaining is text
			if (pos < source.length) {
				// Do not emit if empty
				let start = getSourcePoint()
				advanceTo(source.length)
				tokens.push(createContentToken('text', start))
			}

			if (elementsStack.length) {
				throwSyntaxError(`Unclosed tags: ${elementsStack.map(e => e.name).join(', ')}`)
			}

			break
		}

		if (match.index !== pos) {
			// Emit text
			let start = getSourcePoint()
			advanceTo(match.index)
			tokens.push(createContentToken('text', start))
		}

		advanceTo(regex.lastIndex)
		if (match[1].toUpperCase() === '!DOCTYPE ') {
			// Does not happend when in special element
			if (elementsStack.length) {
				throwSyntaxError('DOCTYPE is only allowed at top level')
			}
			tokens.push(readSimpleToken('doctype', tagEndRegex))
		} else if (match[1] === '!--') {
			// Does not happend when in special element
			tokens.push(readSimpleToken('comment', commentEndRegex))
		} else if (match[1] === '%=') {
			tokens.push(readSimpleToken('ejs-escaped', ejsEndRegex))
		} else if (match[1] === '%-') {
			tokens.push(readSimpleToken('ejs-raw', ejsEndRegex))
		} else if (match[1] === '%') {
			tokens.push(readSimpleToken('ejs-eval', ejsEndRegex))
		} else if (match[1] === '/') {
			let closeTag = readCloseTag(),
				topElement = elementsStack.pop()

			if (!topElement) {
				throwSyntaxError(`Unmatched closing tag at top level: ${closeTag.name}`)
			} else if (topElement.name !== closeTag.name) {
				throwSyntaxError(`Unmatched closing tag: ${closeTag.name}, expected ${topElement.name}`)
			}

			topElement.end = closeTag.end
			let newTopElement = elementsStack[elementsStack.length - 1]
			tokens = newTopElement ? newTopElement.children : rootTokens
			specialElement = ''
		} else if (match[1] === '') {
			// Does not happend when in special element
			let openTag = readOpenTag()
			tokens.push(openTag)

			if (!openTag.isVoid) {
				// Prepare to parse element content
				elementsStack.push(openTag)
				tokens = openTag.children

				if (nonSpecialTextStartRegex.hasOwnProperty(openTag.name)) {
					// Enter special element state
					specialElement = openTag.name
				}
			}
		}
	}

	return rootTokens

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
		advanceTo(pos + match[0].length)
		let end = getSourcePoint()
		return {
			type: 'tag-close',
			start,
			end,
			name: match[1].toLowerCase()
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
		let tagName = match[0].toLowerCase(),
			isVoid = voidElementsRegex.test(tagName)
		advanceTo(pos + tagName.length)

		// Keep reading content
		let selfClose = false,
			attributes = [],
			// Used to detect repeated attributes
			foundAttributeNames = []
		while (true) {
			// Match using anchored regex
			let match = tagOpenContentStartRegex.exec(source.substr(pos))
			if (!match) {
				throwSyntaxError('Invalid open tag')
			}

			advanceTo(pos + match[0].length)
			if (match[1] === '<%-') {
				throwSyntaxError('EJS unescaped tags are not allowed inside open tags')
			} else if (match[1] === '<%=') {
				throwSyntaxError('EJS escaped tags are not allowed inside open tags')
			} else if (match[1] === '<%') {
				throwSyntaxError('EJS eval tags are not allowed inside open tags')
			} else if (match[1] === '>') {
				break
			} else if (match[1] === '/>') {
				selfClose = true
				break
			} else {
				// Attribute start
				let lowerName = match[1].toLowerCase()
				if (foundAttributeNames.indexOf(lowerName) !== -1) {
					throwSyntaxError(`Repeated attribute ${match[1]} in open tag ${tagName}`)
				}
				foundAttributeNames.push(lowerName)
				attributes.push(readAttribute(lowerName))
			}
		}

		if (!isVoid && selfClose) {
			throwSyntaxError('Self-closed tags for non-void elements are not allowed')
		}

		return {
			type: 'element',
			start,
			end: getSourcePoint(),
			name: tagName,
			isVoid,
			attributes,
			children: []
		}
	}

	/**
	 * @param {string} name
	 * @returns {Attribute}
	 */
	function readAttribute(name) {
		// Read value (anchored match)
		let match = attributeValueRegex.exec(source.substr(pos)),
			isBoolean = booleanAttributeRegex.test(name),
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
						name,
						isBoolean,
						value: parts.length ? parts[0].content : '',
						quote
					}
				}
				return {
					type: 'attribute',
					name,
					isBoolean,
					parts: parts,
					quote
				}
			}
		}

		// Missing, unquoted or simple quote value
		return {
			type: 'attribute-simple',
			name,
			isBoolean,
			value: (match && match[1]) || '',
			quote
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
				throwSyntaxError('EJS unescaped tags are not allowed inside attribute values')
			} else if (match[0] === '<%=') {
				parts.push(readSimpleToken('ejs-escaped', ejsEndRegex))
			} else if (match[0] === '<%') {
				throwSyntaxError('EJS eval tags are not allowed inside attribute values')
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
		let curr = getSourcePoint(),
			snippet = getSnippet(source, curr.line, curr.line),
			err = new SyntaxError(`${message}\n${snippet}`)
		err.pos = getSourcePoint()
		throw err
	}
}