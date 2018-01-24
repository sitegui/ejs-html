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
	 * Push more compiled core
	 * @param {string} text
	 */
	prepend(text) {
		this.content = text + this.content
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

	prepend(text) {
		this.sourceNode.prepend(text)
	}

	addToken(token) {
		let lines = token.content.split('\n')
		for (let i = 0; i < lines.length; i++) {
			// I'm not sure if that's how it should be done, but if we add one source node with
			// multiple lines the source map consumer get pretty confused.
			// It'll wrongly emit mulitple mappings, one for each generated line, all pointing
			// to the same original position.
			// Instead, we emit one mapping for each generated line, but with the correct line (line + i)
			let originalLine = token.start.line + i,
				originalColumn = i ? 0 : token.start.column - 1,
				line = lines[i] + (i === lines.length - 1 ? '' : '\n')
			let node = new SourceNode(originalLine, originalColumn, this.filename, line)
			this.sourceNode.add(node)
		}
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