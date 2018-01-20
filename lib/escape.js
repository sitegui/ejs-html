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
module.exports.html = function html(str) {
	if (str === undefined || str === null) {
		return ''
	}
	return String(str).replace(htmlRegex, encodeHTMLChar)
}

/**
 * @type {string}
 */
module.exports.html.standAloneCode = 'function __e(s) {' +
	'return s==null?"":String(s)' +
	'.replace(/&/g,"&amp;")' +
	'.replace(/</g,"&lt;")' +
	'.replace(/>/g,"&gt;")' +
	'.replace(/\'/g,"&#39;")' +
	'.replace(/"/g,"&#34;")' +
	'}'

/**
 * Escape as to make safe to put inside double quotes: x = "..."
 * @param {string} [str]
 * @returns {string}
 */
module.exports.js = function js(str) {
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