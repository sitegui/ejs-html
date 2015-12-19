/*globals describe, it*/
'use strict'

let parse = require('..').parse,
	reduce = require('..').reduce
require('should')

describe('reduce', function () {
	it('should reduce literal text to a simple string', function () {
		reduce(parse('A literal text')).should.be.eql(['A literal text'])

		reduce(parse('Multi\nline')).should.be.eql(['Multi\nline'])
	})

	it('should parse EJS tags', function () {
		reduce(parse('<%eval%><%=escaped%><%-raw%>literal <%% text')).should.be.eql([{
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
		}, 'literal <%% text'])
	})

	it('should remove comment tags', function () {
		reduce(parse('<!--\n-- comment\n-->')).should.be.eql([])
	})

	it('should parse doctype tags', function () {
		reduce(parse('<!DOCTYPE html>')).should.be.eql(['<!DOCTYPE html>'])
	})

	it('should parse basic element tags', function () {
		reduce(parse('<div><input><input/></div >')).should.be.eql(['<div><input><input></div>'])
	})

	it('should parse open tags with literal attributes', function () {
		let source = '<div a="no-quote" \n b=\'s<i>ngle\' c="d<o>uble" d="" checked="yes!"></div>',
			expected = '<div a=no-quote b=\'s<i>ngle\' c="d<o>uble" d checked></div>'
		reduce(parse(source)).should.be.eql([expected])
	})

	it('should parse open tags with dynamic attributes', function () {
		let source = '<div attr="pre<%=code%>post"></div>'
		reduce(parse(source)).should.be.eql([
			'<div attr="pre', {
				type: 'ejs-escaped',
				content: 'code',
				start: getPos('<div attr="pre<%='),
				end: getPos('<div attr="pre<%=code')
			}, 'post"></div>'
		])
	})

	it('should normalize whitespace between attributes', function () {
		minify('<a    b\n\t  \tc></a>').should.be.equal('<a b c></a>')
	})

	it('should collapse whitespaces in html text', function () {
		minify('   no\n   need    for   spaces   ').should.be.equal(' no\nneed for spaces ')

		minify('even <%a%> between <%x%> js ta<%g%>s')
			.should.be.equal('even <%a%>between <%x%>js ta<%g%>s')
	})

	it('should collapse whitespace in class attribute', function () {
		minify('<a class="a   b \n\t c  "></a>').should.be.equal('<a class="a b c"></a>')

		minify('<a class="a <%%>  b<%%>d \n<%%>\t c  "></a>')
			.should.be.equal('<a class="a <%%> b<%%>d <%%> c"></a>')
	})

	it('should collapse boolean attributes', function () {
		minify('<a a="" checked=checked multiple></a>')
			.should.be.equal('<a a checked multiple></a>')

		minify('<a checked="<%=checked%>"></a>')
			.should.be.equal('<a<%if (checked) {%> checked<%}%>></a>')
	})

	it('should keep whitespace inside <pre>-like tags', function () {
		minify('  x  <pre>  x  <b>  x  </b>  </pre>  x  ')
			.should.be.equal(' x <pre>  x  <b>  x  </b>  </pre> x ')
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

function minify(source) {
	return reduce(parse(source)).map(e => {
		if (typeof e === 'string') {
			return e
		}
		let c = e.type === 'ejs-eval' ? '' : (e.type === 'ejs-raw' ? '-' : '=')
		return `<%${c}${e.content}%>`
	}).join('')
}