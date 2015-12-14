'use strict'

let htmlCharMap = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&#34;',
		'\'': '&#39;'
	},
	htmlRegex = /[&<>"']/g,
	jsCharMap = {
		'\\': '\\\\',
		'\n': '\\n',
		'\r': '\\r',
		'"': '\\"'
	},
	jsRegex = /[\\\n\r"]/g

/**
 * @param {string} [str]
 * @returns {string}
 */
module.exports.html = function escape(str) {
	if (str === undefined || str === null) {
		return ''
	}
	return String(str).replace(htmlRegex, encodeHTMLChar)
}

/**
 * Escape as to make safe to put inside double quotes: x = "..."
 * @param {string} [str]
 * @returns {string}
 */
module.exports.js = function escape(str) {
	if (str === undefined || str === null) {
		return ''
	}
	return String(str).replace(jsRegex, encodeJSChar)
}

function encodeHTMLChar(c) {
	return htmlCharMap[c]
}

function encodeJSChar(c) {
	return jsCharMap[c]
}