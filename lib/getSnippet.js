'use strict'

/**
 * Extract the code snippet in the given region
 * @param {string} source - original source
 * @param {number} lineStart
 * @param {number} lineEnd
 * @returns {string}
 */
module.exports = function (source, lineStart, lineEnd) {
	/*jshint esnext:false*/
	var lines = source.split('\n'),
		fromLine = Math.max(1, lineStart - 2) - 1,
		toLine = Math.min(lines.length, lineEnd + 2)
	return lines.slice(fromLine, toLine).map(function (str, i) {
		var lineNum = i + 1 + fromLine
		if (lineNum >= lineStart && lineNum <= lineEnd) {
			return ' ' + lineNum + ' >> | ' + str
		}
		return ' ' + lineNum + '    | ' + str
	}).join('\n')
}