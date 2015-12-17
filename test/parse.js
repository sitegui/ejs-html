/*globals describe, it*/
'use strict'

let parse = require('../lib/parse')
require('should')

describe('parse', function () {
	it('should parse a literal text', function () {
		parse('A literal text').should.be.eql([{
			type: 'text',
			start: getPos(''),
			end: getPos('A literal text'),
			content: 'A literal text'
		}])

		parse('Multi\nline').should.be.eql([{
			type: 'text',
			start: getPos(''),
			end: getPos('Multi\nline'),
			content: 'Multi\nline'
		}])
	})

	it('should parse EJS tags', function () {
		parse('<%eval%><%=escaped%><%-raw%>literal <%% text').should.be.eql([{
			type: 'ejs-eval',
			start: getPos('<%'),
			end: getPos('<%eval'),
			content: 'eval'
		}, {
			type: 'ejs-escaped',
			start: getPos('<%eval%><%='),
			end: getPos('<%eval%><%=escaped'),
			content: 'escaped'
		}, {
			type: 'ejs-raw',
			start: getPos('<%eval%><%=escaped%><%-'),
			end: getPos('<%eval%><%=escaped%><%-raw'),
			content: 'raw'
		}, {
			type: 'text',
			start: getPos('<%eval%><%=escaped%><%-raw%>'),
			end: getPos('<%eval%><%=escaped%><%-raw%>literal <%% text'),
			content: 'literal <%% text'
		}])
	})

	it('should parse comment tags', function () {
		parse('<!--\n-- comment\n-->').should.be.eql([{
			type: 'comment',
			start: getPos('<!--'),
			end: getPos('<!--\n-- comment\n'),
			content: '\n-- comment\n'
		}])
	})

	it('should parse doctype tags', function () {
		parse('<!DOCTYPE html>').should.be.eql([{
			type: 'doctype',
			start: getPos('<!DOCTYPE '),
			end: getPos('<!DOCTYPE html'),
			content: 'html'
		}])
	})

	it('should parse close tags', function () {
		parse('</tag-name></tagName >').should.be.eql([{
			type: 'tag-close',
			start: getPos('</'),
			end: getPos('</tag-name'),
			name: 'tag-name'
		}, {
			type: 'tag-close',
			start: getPos('</tag-name></'),
			end: getPos('</tag-name></tagName'),
			name: 'tagName'
		}])
	})

	it('should parse simple open tags', function () {
		parse('<open><self-close />').should.be.eql([{
			type: 'tag-open',
			start: getPos('<'),
			end: getPos('<open>'),
			name: 'open',
			selfClose: false,
			attributes: []
		}, {
			type: 'tag-open',
			start: getPos('<open><'),
			end: getPos('<open><self-close />'),
			name: 'self-close',
			selfClose: true,
			attributes: []
		}])
	})

	it('should parse open tags with literal attributes', function () {
		parse('<simple a=no-quote \n b=\'s<i>ngle\' c="d<o>uble" d="" e />').should.be.eql([{
			type: 'tag-open',
			start: getPos('<'),
			end: getPos('<simple a=no-quote \n b=\'s<i>ngle\' c="d<o>uble" d="" e />'),
			name: 'simple',
			selfClose: true,
			attributes: [{
				type: 'attribute-simple',
				name: 'a',
				value: 'no-quote',
				quote: ''
			}, {
				type: 'attribute-simple',
				name: 'b',
				value: 's<i>ngle',
				quote: '\''
			}, {
				type: 'attribute-simple',
				name: 'c',
				value: 'd<o>uble',
				quote: '"'
			}, {
				type: 'attribute-simple',
				name: 'd',
				value: '',
				quote: '"'
			}, {
				type: 'attribute-simple',
				name: 'e',
				value: '',
				quote: ''
			}]
		}])
	})

	it('should parse open tags with dynamic attributes', function () {
		let source = '<with-ejs attr="pre<%=code%><%code%>post">'
		parse(source, {
			allowEJSInOpenTags: true
		}).should.be.eql([{
			type: 'tag-open',
			start: getPos('<'),
			end: getPos(source),
			name: 'with-ejs',
			selfClose: false,
			attributes: [{
				type: 'attribute',
				name: 'attr',
				quote: '"',
				parts: [{
					type: 'text',
					content: 'pre'
				}, {
					type: 'ejs-escaped',
					content: 'code',
					start: getPos('<with-ejs attr="pre<%='),
					end: getPos('<with-ejs attr="pre<%=code')
				}, {
					type: 'ejs-eval',
					content: 'code',
					start: getPos('<with-ejs attr="pre<%=code%><%'),
					end: getPos('<with-ejs attr="pre<%=code%><%code')
				}, {
					type: 'text',
					content: 'post'
				}]
			}]
		}])
	})
})

function getPos(str) {
	let lines = str.split('\n')
	return {
		pos: str.length,
		line: lines.length,
		column: lines[lines.length - 1].length + 1
	}
}