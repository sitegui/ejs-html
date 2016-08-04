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
		let render = new Function('locals, renderCustom', code)

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

	it('should add extended exception context', function () {
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
		/*jshint evil:true*/
		let code = compile.standAlone(source, options)
		let render = new Function('locals, renderCustom', code)
		render.should.throw(message)
	})

	it('should not add extended exception context when compileDebug is false', function () {
		let source = 'a\n<% throw new Error("hi") %>\nb',
			options = {
				filename: 'file.ejs',
				compileDebug: false
			}

		// Non-stand alone compilation
		compile(source, options).should.throw('hi')

		// Stand alone compilation
		/*jshint evil:true*/
		let code = compile.standAlone(source, options)
		let render = new Function('locals, renderCustom', code)
		render.should.throw('hi')
	})

	it('should compile custom tags when compileDebug is false', function () {
		compile('<my-tag><my-tag2></my-tag2></my-tag>', {
			compileDebug: false
		})({}, function () {
			return 'hi'
		}).should.be.equal('hi')
	})
})