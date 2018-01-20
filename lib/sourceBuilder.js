'use strict'

let SourceNode = require('source-map').SourceNode

/**
 * An efficient version of SourceMapBuilder with no actual source map generation
 * @class
 */
class SourceBuilder {
	constructor() {
		this.content = ''
	}

	/**
	 * Push more compiled core
	 * @param {string} text
	 */
	add(text) {
		this.content += text
	}

	/**
	 * Push a JS token
	 * @param {Token} token
	 */
	addToken(token) {
		this.content += token.content
	}

	/**
	 * Push a child source builder
	 * @param {SourceBuilder} builder
	 */
	addBuilder(builder) {
		this.content += builder.content
	}

	/**
	 * @param {string} filename
	 * @returns {{code: string, map: ?string}}
	 */
	build() {
		return {
			code: this.content
		}
	}
}

/**
 * This helper class allows to create compiled code and its source map progressively
 * @class
 */
class SourceMapBuilder extends SourceBuilder {
	constructor() {
		super()

		this.sourceNode = new SourceNode
	}

	add(text) {
		this.sourceNode.add(text)
	}

	addToken(token) {
		this.sourceNode.add(new SourceNode(token.start.line, token.start.column - 1, 'ejs', token.content))
		this.sourceNode.add(new SourceNode(token.end.line, token.end.column - 1, 'ejs', ' '))
	}

	addBuilder(builder) {
		this.sourceNode.add(builder.sourceNode)
	}

	build(filename) {
		let {
			code,
			map
		} = this.sourceNode.toStringWithSourceMap({
			file: filename
		})
		return {
			code,
			map: map.toString()
		}
	}
}

/**
 * Get a new builder instance
 * @param {boolean} useSourceMap - if false, overhead is minimal
 * @returns {SourceBuilder}
 */
module.exports = function (useSourceMap) {
	if (useSourceMap) {
		return new SourceMapBuilder
	}
	return new SourceBuilder
}