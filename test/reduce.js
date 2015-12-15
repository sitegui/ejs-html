/*globals describe, it*/
'use strict'

let parse = require('../lib/parse'),
	reduce = require('../lib/reduce')
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

	it('should parse close tags', function () {
		reduce(parse('</tag-name></tagName >')).should.be.eql(['</tag-name></tagName>'])
	})

	it('should parse simple open tags', function () {
		reduce(parse('<open ><self-close   />')).should.be.eql(['<open><self-close/>'])
	})

	it('should parse open tags with literal attributes', function () {
		let source = '<simple a=no-quote\nb=\'s<i>ngle\' c="d<o>ouble" bool=\'\' no-need="for"/>',
			expected = '<simple a=no-quote b=\'s<i>ngle\' c="d<o>ouble" bool no-need=for />'
		reduce(parse(source)).should.be.eql([expected])
	})

	it('should parse open tags with dynamic attributes', function () {
		let lines = [
				'<with-ejs attr="pre<%=code%>post" <% if (showA) { %>',
				'a',
				'<% } %>',
				'<%=code%>>'
			],
			source = lines.join('\n')
		reduce(parse(source, {
			allowEJSInOpenTags: true
		})).should.be.eql([
			'<with-ejs attr="pre', {
				type: 'ejs-escaped',
				content: 'code',
				start: getPos('<with-ejs attr="pre<%='),
				end: getPos('<with-ejs attr="pre<%=code')
			}, 'post"', {
				type: 'ejs-eval',
				start: getPos('<with-ejs attr="pre<%=code%>post" <%'),
				end: getPos('<with-ejs attr="pre<%=code%>post" <% if (showA) { '),
				content: ' if (showA) { '
			}, ' a', {
				type: 'ejs-eval',
				start: getPos(lines[0] + '\n' + lines[1] + '\n<%'),
				end: getPos(lines[0] + '\n' + lines[1] + '\n<% } '),
				content: ' } '
			}, ' ', {
				type: 'ejs-escaped',
				start: getPos(lines[0] + '\n' + lines[1] + '\n' + lines[2] + '\n<%='),
				end: getPos(lines[0] + '\n' + lines[1] + '\n' + lines[2] + '\n<%=code'),
				content: 'code'
			}, '>'
		])
	})

	it('should normalize whitespace between attributes', function () {
		minify('<a    b\n\t  \tc>').should.be.equal('<a b c>')
	})

	it('should collapse whitespaces in html text', function () {
		minify('   no\n   need    for   spaces   ', {
			collapseText: true
		}).should.be.equal(' no\nneed for spaces ')

		minify('even <%a%> between <%x%> js ta<%g%>s', {
			collapseText: true
		}).should.be.equal('even <%a%>between <%x%>js ta<%g%>s')
	})

	it('should collapse whitespace in class attribute', function () {
		minify('<a class="a   b \n\t c  ">', {
			collapseAttribute: true
		}).should.be.equal('<a class="a b c">')

		minify('<a class="a <%%>  b<%%>d \n<%%>\t c  ">', {
			collapseAttribute: true
		}).should.be.equal('<a class="a <%%> b<%%>d <%%> c">')
	})

	it('should collapse boolean attributes', function () {
		minify('<a a="" checked=checked multiple>', {
			boolAttribute: true
		}).should.be.equal('<a a checked multiple>')

		minify('<a checked="<%=checked%>">', {
			boolAttribute: true
		}).should.be.equal('<a<%if (checked) {%> checked<%}%>>')
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

function minify(source, options) {
	return reduce(parse(source), options).map(e => {
		if (typeof e === 'string') {
			return e
		}
		let c = e.type === 'ejs-eval' ? '' : (e.type === 'ejs-raw' ? '-' : '=')
		return `<%${c}${e.content}%>`
	}).join('')
}