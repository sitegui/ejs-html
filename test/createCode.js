/* globals describe, it*/
'use strict'

let ejs = require('..'),
	prepareOptions = ejs._prepareOptions,
	createCode = ejs.compile._createCode
require('should')

describe('createCode', () => {
	it('should handle special static cases', () => {
		check('', {}, false, ['return""'])
		check('', {}, true, ['""'])

		check('Hello', {}, false, ['return"Hello"'])
		check('Hello', {}, true, ['"Hello"'])
	})

	it('should generate a single expression when possible', () => {
		check('Hello <%= locals.firstName %> <%= locals.lastName %>', {
			compileDebug: false
		}, false, [
			'"use strict";',
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'return "Hello "+__e(locals.firstName)+" "+__e(locals.lastName);'
		])
		check('Hello <%= locals.firstName %> <%= locals.lastName %>', {
			compileDebug: false
		}, true, ['"Hello "+__e(locals.firstName)+" "+__e(locals.lastName)'])

		check('<%- locals.firstName %> <%- locals.lastName %>', {
			compileDebug: false
		}, false, [
			'"use strict";',
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'return ""+(locals.firstName)+" "+(locals.lastName);'
		])
		check('<%- locals.firstName %> <%- locals.lastName %>', {
			compileDebug: false
		}, true, ['""+(locals.firstName)+" "+(locals.lastName)'])
	})

	it('should compile with debug markers', () => {
		check([
			'First',
			'<%=a',
			'+b',
			'%> and <%= b %>'
		].join('\n'), {}, false, [
			'"use strict";',
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'return "First\\n"+(__l.s=2,__l.e=3,__e(a\n+b))+" and "+(__l.s=__l.e=4,__e(b));'
		])

		check([
			'First',
			'<%=',
			'a',
			'%> and <%= b %>'
		].join('\n'), {}, true, [
			'"First\\n"+(__l.s=__l.e=3,__e(a))+" and "+(__l.s=__l.e=4,__e(b))'
		])
	})

	it('should generate multiple statements when needed', () => {
		check('<% if (true) { %>true<% } %>', {
			compileDebug: false
		}, false, [
			'"use strict";',
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'let __o="";',
			'if (true) {\n',
			'__o+="true";',
			'}\n',
			'return __o;'
		])
		check('<% if (true) { %>true<% } %>', {
			compileDebug: false
		}, true, [
			'(function(){',
			'let __o="";',
			'if (true) {\n',
			'__o+="true";',
			'}\n',
			'return __o;',
			'})()'
		])

		check('<% if (true) { %>true<% } %>', {}, false, [
			'"use strict";',
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'let __o="";',
			'__l.s=__l.e=1;',
			'if (true) {\n',
			'__o+="true";',
			'__l.s=__l.e=1;',
			'}\n',
			'return __o;'
		])
		check('<% if (true) { %>true<% } %>', {}, true, [
			'(function(){',
			'let __o="";',
			'__l.s=__l.e=1;',
			'if (true) {\n',
			'__o+="true";',
			'__l.s=__l.e=1;',
			'}\n',
			'return __o;',
			'})()'
		])
	})

	it('should compile in sloppy mode', () => {
		check('<%= name %>', {
			strictMode: false,
			compileDebug: false
		}, false, [
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'with(locals){',
			'return __e(name);',
			'}'
		])
	})

	it('should compile with explicit locals bindings', () => {
		check('<%= name %>', {
			vars: ['name'],
			compileDebug: false
		}, false, [
			'"use strict";',
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'let name=locals.name;',
			'return __e(name);'
		])

		check('<%= a+b %>', {
			vars: ['a', 'b'],
			compileDebug: false
		}, false, [
			'"use strict";',
			'locals=locals||{};',
			'let __c=locals.__contents||{};',
			'let a=locals.a,b=locals.b;',
			'return __e(a+b);'
		])
	})
})

function check(source, options, asInnerExpression, code) {
	options = prepareOptions(options)
	let tokens = ejs.reduce(ejs.parse(source), options)

	let builder = createCode(tokens, options, asInnerExpression)
	builder.build().code.should.be.equal(code.join(''))
}