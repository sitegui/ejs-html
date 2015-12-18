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

	it('should parse basic element tags', function () {
		parse('<div><input><input/><tag/></div>').should.be.eql([{
			type: 'element',
			start: getPos('<'),
			end: getPos('<div><input><input/><tag/></div>'),
			name: 'div',
			isVoid: false,
			selfClose: false,
			attributes: [],
			children: [{
				type: 'element',
				start: getPos('<div><'),
				end: getPos('<div><input>'),
				name: 'input',
				isVoid: true,
				selfClose: false,
				attributes: [],
				children: []
			}, {
				type: 'element',
				start: getPos('<div><input><'),
				end: getPos('<div><input><input/>'),
				name: 'input',
				isVoid: true,
				selfClose: true,
				attributes: [],
				children: []
			}, {
				type: 'element',
				start: getPos('<div><input><input/><'),
				end: getPos('<div><input><input/><tag/>'),
				name: 'tag',
				isVoid: false,
				selfClose: true,
				attributes: [],
				children: []
			}]
		}])
	})

	it('should parse simple open tags', function () {
		parse('<open><self-close /></open>').should.be.eql([{
			type: 'element',
			start: getPos('<'),
			end: getPos('<open><self-close /></open>'),
			name: 'open',
			isVoid: false,
			selfClose: false,
			attributes: [],
			children: [{
				type: 'element',
				start: getPos('<open><'),
				end: getPos('<open><self-close />'),
				name: 'self-close',
				isVoid: false,
				selfClose: true,
				attributes: [],
				children: []
			}]
		}])
	})

	it('should parse open tags with literal attributes', function () {
		parse('<simple a=no-quote \n b=\'s<i>ngle\' c="d<o>uble" d="" checked />').should.be.eql([{
			type: 'element',
			start: getPos('<'),
			end: getPos('<simple a=no-quote \n b=\'s<i>ngle\' c="d<o>uble" d="" checked />'),
			name: 'simple',
			isVoid: false,
			selfClose: true,
			attributes: [{
				type: 'attribute-simple',
				name: 'a',
				isBoolean: false,
				value: 'no-quote',
				quote: ''
			}, {
				type: 'attribute-simple',
				name: 'b',
				isBoolean: false,
				value: 's<i>ngle',
				quote: '\''
			}, {
				type: 'attribute-simple',
				name: 'c',
				isBoolean: false,
				value: 'd<o>uble',
				quote: '"'
			}, {
				type: 'attribute-simple',
				name: 'd',
				isBoolean: false,
				value: '',
				quote: '"'
			}, {
				type: 'attribute-simple',
				name: 'checked',
				isBoolean: true,
				value: '',
				quote: ''
			}],
			children: []
		}])
	})

	it('should parse open tags with dynamic attributes', function () {
		let source = '<with-ejs attr="pre<%=code%><%code%>post"/>'
		parse(source).should.be.eql([{
			type: 'element',
			start: getPos('<'),
			end: getPos(source),
			name: 'with-ejs',
			isVoid: false,
			selfClose: true,
			attributes: [{
				type: 'attribute',
				name: 'attr',
				isBoolean: false,
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
			}],
			children: []
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