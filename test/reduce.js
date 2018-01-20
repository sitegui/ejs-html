/* globals describe, it*/
'use strict'

let parse = require('..').parse,
	reduce = require('..').reduce
require('should')

describe('reduce', () => {
	it('should reduce literal text to a simple string', () => {
		reduce(parse('A literal text')).should.be.eql(['A literal text'])

		reduce(parse('Multi\nline')).should.be.eql(['Multi\nline'])
	})

	it('should parse EJS tags', () => {
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

	it('should remove comment tags', () => {
		reduce(parse('<!--\n-- comment\n-->')).should.be.eql([])
	})

	it('should parse doctype tags', () => {
		reduce(parse('<!DOCTYPE html>')).should.be.eql(['<!DOCTYPE html>'])
	})

	it('should parse basic element tags', () => {
		reduce(parse('<div><input><input/></div >')).should.be.eql(['<div><input><input></div>'])
	})

	it('should parse open tags with literal attributes', () => {
		let source = '<div a="no-quote" \n b=\'s<i>ngle\' c="d<o>uble" d="" checked="yes!"></div>',
			expected = '<div a=no-quote b=\'s<i>ngle\' c="d<o>uble" d checked></div>'
		reduce(parse(source)).should.be.eql([expected])
	})

	it('should parse open tags with dynamic attributes', () => {
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

	it('should normalize whitespace between attributes', () => {
		minify('<a    b\n\t  \tc></a>').should.be.equal('<a b c></a>')
	})

	it('should collapse whitespaces in html text', () => {
		minify('   no\n   need    for   spaces   ').should.be.equal(' no\nneed for spaces ')

		minify('even <%a%> between <%x%> js ta<%g%>s')
			.should.be.equal('even <%a%>between <%x%>js ta<%g%>s')
	})

	it('should collapse whitespace in class attribute', () => {
		minify('<a class="a   b \n\t c  "></a>').should.be.equal('<a class="a b c"></a>')

		minify('<a class="a <%%>  b<%%>d \n<%%>\t c  "></a>')
			.should.be.equal('<a class="a <%%> b<%%>d <%%> c"></a>')
	})

	it('should collapse boolean attributes', () => {
		minify('<a a="" checked=checked multiple></a>')
			.should.be.equal('<a a checked multiple></a>')

		minify('<a checked="<%=checked%>"></a>')
			.should.be.equal('<a<%-(checked)?" checked":""%>></a>')
	})

	it('should keep whitespace inside <pre>-like tags', () => {
		minify('  x  <pre>  x  <b>  x  </b>  </pre>  x  ')
			.should.be.equal(' x <pre>  x  <b>  x  </b>  </pre> x ')
	})

	it('should treat spaces around EJS tags correctly', () => {
		minify('before  <%= 2 %>  after').should.be.equal('before <%=2%> after')
		minify('before  <%- 2 %>  after').should.be.equal('before <%-2%> after')
		minify('before  <% 2 %>  after').should.be.equal('before <%2%>after')
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
		} else if (e.type === 'source-builder') {
			return `<%-${e.sourceBuilder.build().code}%>`
		}
		let c = e.type === 'ejs-eval' ? '' : (e.type === 'ejs-raw' ? '-' : '=')
		return `<%${c}${e.content}%>`
	}).join('')
}