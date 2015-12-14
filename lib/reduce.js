'use strict'

let validUnquotedRegex = /^[^\s>"'<=`]*$/

/**
 * Remove comments and transform fixed tokens back to text.
 * The returned array has strings for fixed content and Token instances for dynamic ones
 * The token types on the resulting array may have one of the types: ejs-eval, ejs-escaped, ejs-raw
 * @param {Array<Token>} tokens
 * @param {Object} [options]
 * @param {boolean} [options.collapseText=false]
 * @param {boolean} [options.collapseAttribute=false]
 * @returns {Array<Token|string>}
 */
module.exports = function (tokens, options) {
	let newTokens = []

	options = options || {}

	for (let i = 0, len = tokens.length; i < len; i++) {
		let token = tokens[i]

		if (token.type === 'text') {
			let text = token.content
			if (options.collapseText) {
				text = text.replace(/(\s)\s+/g, '$1')
			}
			appendText(text)
		} else if (token.type === 'ejs-eval') {
			newTokens.push(token)
		} else if (token.type === 'ejs-escaped') {
			newTokens.push(token)
		} else if (token.type === 'ejs-raw') {
			newTokens.push(token)
		} else if (token.type === 'comment') {
			// Removed
		} else if (token.type === 'tag-close') {
			appendText(`</${token.name}>`)
		} else if (token.type === 'doctype') {
			appendText(`<!DOCTYPE ${token.content}>`)
		} else if (token.type === 'tag-open') {
			appendText(`<${token.name}`)
			appendAttributes(token.attributes, token.selfClose, options.collapseAttribute)
			appendText(token.selfClose ? '/>' : '>')
		}
	}

	return newTokens

	/**
	 * Append to the content of the text token at the tip
	 * (or add a new one if none exists yet)
	 */
	function appendText(str) {
		let i = newTokens.length - 1,
			last = newTokens[i]
		if (typeof last === 'string') {
			newTokens[i] += str
		} else {
			newTokens.push(str)
		}
	}

	/**
	 * @param {Array<Attribute>} attributes
	 * @param {boolean} selfClose
	 * @param {boolean} collapse
	 */
	function appendAttributes(attributes, selfClose, collapse) {
		let lastIsUnquoted = false
		for (let i = 0, len = attributes.length; i < len; i++) {
			let attribute = attributes[i]

			if (attribute.type === 'attribute-simple') {
				let value
				if (!attribute.value) {
					// Empty value is the default in HTML
					value = ''
					lastIsUnquoted = false
				} else if (validUnquotedRegex.test(attribute.value)) {
					// No need to put around quotes
					value = `=${attribute.value}`
					lastIsUnquoted = true
				} else {
					// Use original quote
					value = `=${attribute.quote}${attribute.value}${attribute.quote}`
					lastIsUnquoted = false
				}
				appendText(` ${attribute.name}${value}`)
			} else if (attribute.type === 'attribute') {
				appendText(` ${attribute.name}=${attribute.quote}`)
				appendAttributeParts(attribute.parts, collapse && attribute.name === 'class')
				appendText(attribute.quote)
				lastIsUnquoted = false
			} else if (attribute.type === 'ejs-escaped') {
				appendText(' ')
				newTokens.push(attribute)

				// We don't know, so play safe
				lastIsUnquoted = true
			} else if (attribute.type === 'ejs-eval') {
				newTokens.push(attribute)
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
					text = text.replace(/(\s)\s+/g, '$1')
				}
				appendText(text)
			} else if (part.type === 'ejs-escaped' || part.type === 'ejs-eval') {
				newTokens.push(part)
			}
		}
	}
}