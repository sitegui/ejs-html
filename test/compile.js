/* globals describe, it*/
'use strict'

let compile = require('..').compile
require('should')

describe('compile', () => {
	it('should compile to run in the server', () => {
		compile('Hi <b><%=name.first%></b> <%=name.last%>!')({
			name: {
				first: 'Gui',
				last: 'S'
			}
		}).should.be.equal('Hi <b>Gui</b> S!')
	})

	it('should compile to run in the client', () => {
		let code = compile.standAlone('Hi <b><%=name.first%></b> <%=name.last%>!')

		// eslint-disable-next-line no-new-func
		let render = new Function('locals, renderCustom', code)

		render({
			name: {
				first: 'Gui',
				last: 'S'
			}
		}).should.be.equal('Hi <b>Gui</b> S!')
	})

	it('should support transformers', () => {
		compile('<i>Hi</i> <p><i>Deep</i></p>', {
			transformer: function transformer(tokens) {
				tokens.forEach(token => {
					if (token.type === 'element') {
						if (token.name === 'i') {
							token.name = 'em'
						}
						transformer(token.children)
					}
				})
			}
		})().should.be.equal('<em>Hi</em> <p><em>Deep</em></p>')
	})

	it('should add extended exception context', () => {
		let source = 'a\n<% throw new Error("hi") %>\nb',
			options = {
				filename: 'file.ejs'
			},
			message = `file.ejs:2
 1    | a
 2 >> | <% throw new Error("hi") %>
 3    | b

hi`

		// Non-stand alone compilation
		compile(source, options).should.throw(message)

		// Stand alone compilation
		let code = compile.standAlone(source, options)
		// eslint-disable-next-line no-new-func
		let render = new Function('locals, renderCustom', code)
		render.should.throw(message)
	})

	it('should not add extended exception context when compileDebug is false', () => {
		let source = 'a\n<% throw new Error("hi") %>\nb',
			options = {
				filename: 'file.ejs',
				compileDebug: false
			}

		// Non-stand alone compilation
		compile(source, options).should.throw('hi')

		// Stand alone compilation
		let code = compile.standAlone(source, options)
		// eslint-disable-next-line no-new-func
		let render = new Function('locals, renderCustom', code)
		render.should.throw('hi')
	})

	it('should compile custom tags when compileDebug is false', () => {
		compile('<my-tag><my-tag2></my-tag2></my-tag>', {
			compileDebug: false
		})({}, () => 'hi').should.be.equal('hi')
	})
})