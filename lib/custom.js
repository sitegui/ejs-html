'use strict'

let jsEscape = require('./escape').js,
	reduce = require('./reduce'),
	compile = require('./compile')

/**
 * @param {Token} element
 * @param {Object} options - already prepared
 * @returns {Token} - an ejs-raw token
 * @private
 */
module.exports.prepareContent = function (element, options) {
	let jsCode = 'renderCustom('

	// First parameter: tag name
	jsCode += `"${jsEscape(element.name)}",{`

	// Second argument: locals
	for (let i = 0; i < element.attributes.length; i++) {
		let attribute = element.attributes[i]
		jsCode += `"${jsEscape(makeCamelCase(attribute.name))}":`

		if (attribute.type === 'attribute-simple') {
			if (attribute.quote === '' && attribute.value === '') {
				// Pseudo-boolean attribute
				jsCode += 'true'
			} else {
				jsCode += `"${jsEscape(attribute.value)}"`
			}
		} else if (attribute.type === 'attribute') {
			let firstPart = attribute.parts[0]

			if (attribute.parts.length === 1 && firstPart.type === 'ejs-escaped') {
				// Special case for <tag attr="<%=value%>">
				// Pass `value` directly, without casting to string
				appendJSValue(firstPart)
			} else {
				appendExpressionFromParts(attribute.parts)
			}

		}
		jsCode += ','
	}

	jsCode += '__contents:{'

	let contents = prepareContents(element.children)
	contents.forEach((tokens, name) => {
		let content = compile._createCode(reduce(tokens, options), options, true)
		jsCode += `"${jsEscape(name)}":${content},`
	})

	jsCode += options.compileDebug ?
		`}},${compile._getDebugMarker(element)})` :
		'}})'

	return {
		type: 'ejs-raw',
		start: element.start,
		end: element.end,
		content: jsCode
	}

	/**
	 * @param {Array<ValuePart>} parts
	 */
	function appendExpressionFromParts(parts) {
		for (let i = 0, len = parts.length; i < len; i++) {
			let part = parts[i]
			if (i) {
				jsCode += '+'
			}
			if (part.type === 'text') {
				jsCode += `"${jsEscape(part.content)}"`
			} else if (part.type === 'ejs-escaped') {
				jsCode += 'String('
				appendJSValue(part)
				jsCode += ')'
			} else if (part.type === 'ejs-eval') {
				throw new Error('EJS eval tags are not allowed inside attribute values in custom elements')
			}
		}
	}

	/**
	 * Append ejs expression, with position update
	 * @param {Token} token - ejs-escaped token
	 */
	function appendJSValue(token) {
		if (options.compileDebug) {
			jsCode += `(${compile._getDebugMarker(token)},${token.content})`
		} else {
			jsCode += `(${token.content})`
		}
	}
}

/**
 * @param {Token} element
 * @param {Object} options - already prepared
 * @returns {Token} - an ejs-raw token
 */
module.exports.preparePlaceholder = function (element, options) {
	let name = getNameAttributeValue(element),
		escapedName = jsEscape(name),
		content = compile._createCode(reduce(element.children, options), options, true)
	return {
		type: 'ejs-raw',
		start: element.start,
		end: element.end,
		content: `__c["${escapedName}"]&&/\\S/.test(__c["${escapedName}"])?__c["${escapedName}"]:${content}`
	}
}

/**
 * Split children tokens by content name
 * @param {Array<Token>} tokens
 * @returns {Map<string, Array<Token>>}
 */
function prepareContents(tokens) {
	let contents = new Map

	for (let i = 0, len = tokens.length; i < len; i++) {
		let token = tokens[i]

		if (token.type === 'element' && token.name === 'eh-content') {
			// Find attribute 'name'
			let name = getNameAttributeValue(token),
				arr = getArr(name)

			for (let j = 0, len2 = token.children.length; j < len2; j++) {
				arr.push(token.children[j])
			}
		} else {
			getArr('').push(token)
		}
	}

	/**
	 * @param {string} name
	 * @returns {Array<Token>}
	 */
	function getArr(name) {
		if (!contents.has(name)) {
			let arr = []
			contents.set(name, arr)
			return arr
		}
		return contents.get(name)
	}

	return contents
}

/**
 * Return the value of the `value` attribute
 * @param {Token} element - must be of type 'element'
 * @returns {string}
 */
function getNameAttributeValue(element) {
	for (let i = 0, len = element.attributes.length; i < len; i++) {
		let attribute = element.attributes[i]

		if (attribute.name === 'name') {
			if (attribute.type !== 'attribute-simple') {
				throw new Error(`name attribute for ${element.name} tag must be a literal value`)
			}
			return attribute.value
		}
	}

	return ''
}

/**
 * Turn dashed notation to camel case.
 * Example: 'ejs-html' to 'ejsHtml'
 * @param {string} name
 * @returns {string}
 */
function makeCamelCase(name) {
	return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}