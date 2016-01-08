/*globals describe, it*/
'use strict'

let compile = require('..').compile
require('should')

describe('compile', function () {
	it('should compile to run in the server', function () {
		compile('Hi <b><%=name.first%></b> <%=name.last%>!')({
			name: {
				first: 'Gui',
				last: 'S'
			}
		}).should.be.equal('Hi <b>Gui</b> S!')
	})

	it('should compile to run in the client', function () {
		let code = compile.standAlone('Hi <b><%=name.first%></b> <%=name.last%>!')

		/*jshint evil:true*/
		let render = new Function('locals, customRender', code)

		render({
			name: {
				first: 'Gui',
				last: 'S'
			}
		}).should.be.equal('Hi <b>Gui</b> S!')
	})

	it('should support transformers', function () {
		compile('<i>Hi</i> <p><i>Deep</i></p>', {
			transformer: function translate(tokens) {
				tokens.forEach(token => {
					if (token.type === 'element') {
						if (token.name === 'i') {
							token.name = 'em'
						}
						translate(token.children)
					}
				})
			}
		})().should.be.equal('<em>Hi</em> <p><em>Deep</em></p>')
	})

	it('should compile to run in the server and client at once', function () {
		let both = compile.both('<b><%= text %></b>'),
			/*jshint evil:true*/
			clientRender = new Function('locals, customRender', both.code)

		both.render({
			text: '<I>'
		}).should.be.equal('<b>&lt;I&gt;</b>')

		clientRender({
			text: '<I>'
		}).should.be.equal('<b>&lt;I&gt;</b>')
	})
})