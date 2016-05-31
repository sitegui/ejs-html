'use strict'

let validUnquotedRegex = /^[^\s>"'<=`]*$/,
	// Elements to keep inner whitespaces
	keepWhitespaceRegex = /^(script|style|pre|textarea)$/i,
	custom

/**
 * Remove comments and transform fixed tokens back to text.
 * The returned array has strings for fixed content and Token instances for dynamic ones
 * The token types on the resulting array may have one of the types: ejs-eval, ejs-escaped, ejs-raw
 * @param {Array<Token>} tokens
 * @param {boolean} [compileDebug=true] - whether to compile debug data in custom elements
 * @returns {Array<Token|string>}
 */
module.exports = function (tokens, compileDebug) {
	let newTokens = [],
		lastTextWasPlain = false,
		lastPlainTextWasSpaced = false

	if (compileDebug === undefined) {
		compileDebug = true
	}

	appendTokens(tokens, false)

	return newTokens

	/**
	 * @param {Array<Token>} tokens
	 * @param {boolean} keepWhitespace
	 */
	function appendTokens(tokens, keepWhitespace) {
		for (let i = 0, len = tokens.length; i < len; i++) {
			let token = tokens[i]

			if (token.type === 'text') {
				appendText(token.content, !keepWhitespace)
			} else if (token.type === 'ejs-eval') {
				newTokens.push(token)
			} else if (token.type === 'ejs-escaped') {
				newTokens.push(token)
				lastTextWasPlain = false
			} else if (token.type === 'ejs-raw') {
				newTokens.push(token)
				lastTextWasPlain = false
			} else if (token.type === 'comment') {
				// Removed
			} else if (token.type === 'doctype') {
				appendText(`<!DOCTYPE ${token.content}>`, false)
			} else if (token.type === 'element') {
				if (token.name === 'eh-content') {
					throw new Error('Unexpected eh-content tag')
				} else if (token.name === 'eh-placeholder') {
					// Custom element content placeholder
					newTokens.push(custom.preparePlaceholder(token, compileDebug))
					continue
				} else if (token.name.includes('-')) {
					// Custom element
					newTokens.push(custom.prepareContent(token, compileDebug))
					continue
				}

				appendText(`<${token.name}`, false)
				appendAttributes(token.attributes)
				appendText('>', false)

				if (!token.isVoid) {
					let keepChildWhitespace = keepWhitespace || keepWhitespaceRegex.test(token.name)
					appendTokens(token.children, keepChildWhitespace)
					appendText(`</${token.name}>`, false)
				}
			}
		}
	}

	/**
	 * Append to the content of the text token at the tip
	 * (or add a new one if none exists yet)
	 * @param {string} str
	 * @param {boolean} isPlainText - remove some spaces
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
	 */
	function appendAttributes(attributes) {
		for (let i = 0, len = attributes.length; i < len; i++) {
			let attribute = attributes[i]

			if (attribute.type === 'attribute-simple') {
				let value = attribute.value

				if (attribute.name === 'class') {
					value = value.trim().replace(/\s+/g, ' ')
				} else if (value && attribute.isBoolean) {
					// Boolean attributes don't need a value
					value = ''
				}

				if (!value) {
					// Empty value is the default in HTML
					value = ''
				} else if (validUnquotedRegex.test(value)) {
					// No need to put around quotes
					value = `=${value}`
				} else {
					// Use original quote
					value = `=${attribute.quote}${value}${attribute.quote}`
				}
				appendText(` ${attribute.name}${value}`, false)
			} else if (attribute.type === 'attribute') {
				let firstPart = attribute.parts[0]
				if (attribute.isBoolean &&
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
					appendText(` ${attribute.name}`, false)
					newTokens.push({
						type: 'ejs-eval',
						start: firstPart.start,
						end: firstPart.end,
						content: '}'
					})
					continue
				}

				appendText(` ${attribute.name}=${attribute.quote}`, false)
				appendAttributeParts(attribute.parts, attribute.name === 'class')
				appendText(attribute.quote, false)
			}
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

custom = require('./custom')