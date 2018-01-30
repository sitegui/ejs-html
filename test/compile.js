/* globals describe, it*/
'use strict'

let compile = require('..').compile,
	sourceMap = require('source-map')
require('should')

describe('compile', () => {
	it('should compile to run in the server', () => {
		compile('Hi <b><%=name.first%></b> <%=name.last%>!', {
			vars: ['name']
		})({
			name: {
				first: 'Gui',
				last: 'S'
			}
		}).should.be.equal('Hi <b>Gui</b> S!')
	})

	it('should compile to run in the client', () => {
		let code = compile.standAlone('Hi <b><%=name.first%></b> <%=name.last%>!', {
			vars: ['name']
		})

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

	it('should generate source map', function (done) {
		if (process.version < 'v8') {
			return this.skip()
		}

		let source = `Basic tags: <%= user %> <%- user %> <% if (true) { %>
			<tag simple="yes" active concat="a and <%= b %>"></tag>
			<custom-tag simple="yes" active concat="a and <%= b %>" obj="<%= {a: 2} %>">
				outside
				<eh-content name="named">inside</eh-content>
			</custom-tag>
			<eh-placeholder>not named</eh-placeholder>
			<eh-placeholder>named</eh-placeholder>
			<% } %>`,
			fn = compile(source, {
				sourceMap: true
			})

		fn.code.should.be.eql('"use strict";locals=locals||{};let __c=locals.__contents||{};let __o="Basic tags: "+(__l.s=__l.e=1,__e(user))+" "+(__l.s=__l.e=1,(user))+" ";__l.s=__l.e=1;if (true) {\n' +
			'__o+="<tag simple=yes active concat=\\"a and "+(__l.s=__l.e=2,__e(b))+"\\"></tag>\\n"+(__l.s=3,__l.e=6,renderCustom("custom-tag",{"simple":"yes","active":true,"concat":"a and "+String((__l.s=__l.e=3,b)),"obj":(__l.s=__l.e=3,{a: 2}),__contents:{"":"\\noutside\\n","named":"inside"}},__l.s=3,__l.e=6))+"\\n"+(__l.s=__l.e=7,__c[""]&&/\\S/.test(__c[""])?__c[""]:"not named")+"\\n"+(__l.s=__l.e=8,__c[""]&&/\\S/.test(__c[""])?__c[""]:"named")+"\\n";__l.s=__l.e=9;}\n' +
			'return __o;')
		fn.map.should.be.eql('{"version":3,"sources":["ejs"],"names":[],"mappings":"uGAAgB,I,uBAAY,I,qBAAW,W;iEACO,C,kIACO,C,wBAAe,M,6NAM9D,C","file":"ejs.js"}')
		fn.mapWithCode.should.be.eql('{"version":3,"sources":["ejs"],"names":[],"mappings":"uGAAgB,I,uBAAY,I,qBAAW,W;iEACO,C,kIACO,C,wBAAe,M,6NAM9D,C","file":"ejs.js","sourcesContent":["Basic tags: <%= user %> <%- user %> <% if (true) { %>\\n\\t\\t\\t<tag simple=\\"yes\\" active concat=\\"a and <%= b %>\\"></tag>\\n\\t\\t\\t<custom-tag simple=\\"yes\\" active concat=\\"a and <%= b %>\\" obj=\\"<%= {a: 2} %>\\">\\n\\t\\t\\t\\toutside\\n\\t\\t\\t\\t<eh-content name=\\"named\\">inside</eh-content>\\n\\t\\t\\t</custom-tag>\\n\\t\\t\\t<eh-placeholder>not named</eh-placeholder>\\n\\t\\t\\t<eh-placeholder>named</eh-placeholder>\\n\\t\\t\\t<% } %>"]}')

		new sourceMap.SourceMapConsumer(fn.map).then(consumer => {
			consumer.computeColumnSpans()
			let codes = []
			consumer.eachMapping(mapping => {
				if (!mapping.originalLine) {
					return
				}
				let length = mapping.lastGeneratedColumn - mapping.generatedColumn + 1,
					original = extract(source, mapping.originalLine, mapping.originalColumn, length),
					generated = extract(fn.code, mapping.generatedLine, mapping.generatedColumn, length)
				original.should.be.eql(generated)
				codes.push(original)
			})

			codes.should.be.eql([
				'user',
				'user',
				'if (true) {',
				'b',
				'b',
				'{a: 2}',
				'}'
			])

			done()
		})

		function extract(str, line, column, length) {
			return str.split('\n')[line - 1].slice(column, column + length)
		}
	})

	it('should check for placeholder emptiness the same way regardless compileDebug', () => {
		compile('out <eh-placeholder>in</eh-placeholder>')({}).should.be.eql('out in')

		compile('out <eh-placeholder>in</eh-placeholder>', {
			compileDebug: false
		})({}).should.be.eql('out in')
	})

	it('should check for boolean attributes the same way regardless compileDebug', () => {
		compile('<a b=c selected="<%= locals.x %>"></a>')({
			x: false
		}).should.be.eql('<a b=c></a>')

		compile('<a b=c selected="<%= locals.x %>"></a>', {
			compileDebug: false
		})({
			x: false
		}).should.be.eql('<a b=c></a>')
	})
})