'use strict'
/* eslint prefer-arrow-callback: off */

/**
 * Extract the code snippet in the given region
 * @param {string} source - original source
 * @param {number} lineStart
 * @param {number} lineEnd
 * @returns {string}
 */
module.exports = function (source, lineStart, lineEnd) {
	let fromLine = Math.max(0, lineStart - 3)
	return source.split('\n').slice(fromLine, lineEnd + 2).map(function (str, i) {
		let lineNum = i + 1 + fromLine
		return ' ' + lineNum + ' ' + (lineNum >= lineStart && lineNum <= lineEnd ? '>>' : '  ') + ' | ' + str
	}).join('\n')
}

/**
 * Like getSnippet(), but with minimized code
 */
module.exports.min = function (a, b, c) {
	let d = Math.max(0, b - 3)
	return a.split('\n').slice(d, c + 2).map(function (e, i) {
		let f = i + 1 + d
		return ' ' + f + ' ' + (f >= b && f <= c ? '>>' : '  ') + ' | ' + e
	}).join('\n')
}