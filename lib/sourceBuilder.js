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
	 * @returns {{code: string, map: ?string, mapWithCode: ?string}}
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
	constructor(filename) {
		super()

		this.sourceNode = new SourceNode
		this.filename = filename
	}

	add(text) {
		this.sourceNode.add(text)
	}

	addToken(token) {
		this.sourceNode.add(new SourceNode(token.start.line, token.start.column - 1, this.filename, token.content))
	}

	addBuilder(builder) {
		this.sourceNode.add(builder.sourceNode)
	}

	build(source) {
		let {
			code,
			map
		} = this.sourceNode.toStringWithSourceMap({
			file: this.filename + '.js'
		})
		let mapAsStr = map.toString()
		map.setSourceContent(this.filename, source)
		return {
			code,
			map: mapAsStr,
			mapWithCode: map.toString()
		}
	}
}

/**
 * Get a new builder instance
 * @param {Object} options - already prepared
 * @returns {SourceBuilder}
 */
module.exports = function (options) {
	if (options.sourceMap) {
		return new SourceMapBuilder(options.filename)
	}
	return new SourceBuilder
}