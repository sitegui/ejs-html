'use strict'

let validUnquotedRegex = /^[^\s>"'<=`]*$/,
	// Attributes that are boolean
	booleanRegex = /^allowfullscreen|async|autofocus|autoplay|checked|compact|controls|declare|default|defaultchecked|defaultmuted|defaultselected|defer|disabled|enabled|formnovalidate|hidden|indeterminate|inert|ismap|itemscope|loop|multiple|muted|nohref|noresize|noshade|novalidate|nowrap|open|pauseonexit|readonly|required|reversed|scoped|seamless|selected|sortable|spellcheck|truespeed|typemustmatch|visible$/i

/**
 * Remove comments and transform fixed tokens back to text.
 * The returned array has strings for fixed content and Token instances for dynamic ones
 * The token types on the resulting array may have one of the types: ejs-eval, ejs-escaped, ejs-raw
 * @param {Array<Token>} tokens
 * @returns {Array<Token|string>}
 */
module.exports = function (tokens) {
	let newTokens = [],
		lastTextWasPlain = false,
		lastPlainTextWasSpaced = false

	for (let i = 0, len = tokens.length; i < len; i++) {
		let token = tokens[i]

		if (token.type === 'text') {
			appendText(token.content, true)
		} else if (token.type === 'ejs-eval') {
			newTokens.push(token)
		} else if (token.type === 'ejs-escaped') {
			newTokens.push(token)
		} else if (token.type === 'ejs-raw') {
			newTokens.push(token)
		} else if (token.type === 'comment') {
			// Removed
		} else if (token.type === 'tag-close') {
			appendText(`</${token.name}>`, false)
		} else if (token.type === 'doctype') {
			appendText(`<!DOCTYPE ${token.content}>`, false)
		} else if (token.type === 'tag-open') {
			appendText(`<${token.name}`, false)
			appendAttributes(token.attributes, token.selfClose)
			appendText(token.selfClose ? '/>' : '>', false)
		}
	}

	return newTokens

	/**
	 * Append to the content of the text token at the tip
	 * (or add a new one if none exists yet)
	 * @param {string} str
	 * @param {boolean} isPlainText - remove some spaces if collapseText is true
	 */
	function appendText(str, isPlainText) {
		let i = newTokens.length - 1,
			last = newTokens[i]

		if (isPlainText) {
			if (lastTextWasPlain && lastPlainTextWasSpaced) {
				// Remove preceding spaces, since the last plain text
				// ended in spaces
				str = str.trimLeft()
			}

			str = str.replace(/(\s)\s+/g, '$1')
			lastPlainTextWasSpaced = /^\s$/.test(str.substr(-1))
		}
		lastTextWasPlain = isPlainText

		if (typeof last === 'string') {
			newTokens[i] += str
		} else {
			newTokens.push(str)
		}
	}

	/**
	 * @param {Array<Attribute>} attributes
	 * @param {boolean} selfClose
	 */
	function appendAttributes(attributes, selfClose) {
		let lastIsUnquoted = false
		for (let i = 0, len = attributes.length; i < len; i++) {
			let attribute = attributes[i]

			if (attribute.type === 'attribute-simple') {
				let value = attribute.value

				if (attribute.name === 'class') {
					value = value.trim().replace(/\s+/g, ' ')
				} else if (value && booleanRegex.test(attribute.name)) {
					// Boolean attributes don't need a value
					value = ''
				}

				if (!value) {
					// Empty value is the default in HTML
					value = ''
					lastIsUnquoted = false
				} else if (validUnquotedRegex.test(value)) {
					// No need to put around quotes
					value = `=${value}`
					lastIsUnquoted = true
				} else {
					// Use original quote
					value = `=${attribute.quote}${value}${attribute.quote}`
					lastIsUnquoted = false
				}
				appendText(` ${attribute.name}${value}`)
			} else if (attribute.type === 'attribute') {
				let firstPart = attribute.parts[0]
				if (booleanRegex.test(attribute.name) &&
					attribute.parts.length === 1 &&
					firstPart.type === 'ejs-escaped') {
					// Special case for <tag attr="<%=value%>">, treat this as:
					// <tag<%if (value) {%> attr<%}%>>
					// Since attr is boolean, we don't want to output it
					// when `value` is falsy
					newTokens.push({
						type: 'ejs-eval',
						start: firstPart.start,
						end: firstPart.end,
						content: `if (${firstPart.content}) {`
					})
					appendText(` ${attribute.name}`)
					lastIsUnquoted = false
					newTokens.push({
						type: 'ejs-eval',
						start: firstPart.start,
						end: firstPart.end,
						content: '}'
					})
					continue
				}

				appendText(` ${attribute.name}=${attribute.quote}`)
				appendAttributeParts(attribute.parts, attribute.name === 'class')
				appendText(attribute.quote)
				lastIsUnquoted = false
			}
		}

		if (lastIsUnquoted && selfClose) {
			// Otherwise, we would output '<a name=value/>' and it would
			// be read by browsers as '<a name="value/">'
			appendText(' ')
		}
	}

	/**
	 * @param {Array<ValuePart>} parts
	 * @param {boolean} collapse
	 */
	function appendAttributeParts(parts, collapse) {
		for (let i = 0, len = parts.length; i < len; i++) {
			let part = parts[i]

			if (part.type === 'text') {
				let text = part.content
				if (collapse) {
					text = text.replace(/\s+/g, ' ')
				}
				appendText(text)
			} else if (part.type === 'ejs-escaped' || part.type === 'ejs-eval') {
				newTokens.push(part)
			}
		}
	}
}