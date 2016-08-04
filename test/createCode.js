/*globals describe, it*/
'use strict'

let ejs = require('..'),
	createCode = ejs.compile.createCode
require('should')

describe('createCode', function () {
	it('should handle special static cases', function () {
		createCode([], true, false).should.be.equal('return ""')
		createCode([], true, true).should.be.equal('""')

		createCode(['hi'], true, false).should.be.equal('return "hi"')
		createCode(['hi'], true, true).should.be.equal('"hi"')
	})

	it('should generate a single expression when possible', function () {
		let tokens = getTokens('Hello <%= user %>')
		createCode(tokens, false, false).should.be.equal([
			'locals = locals || {};',
			'var __c = locals.__contents || {};',
			'with (locals) {',
			'return "Hello " + __e(user);',
			'}'
		].join('\n'))
		createCode(tokens, false, true).should.be.equal('"Hello " + __e(user)')

		let tokens2 = getTokens('<%- user %>')
		createCode(tokens2, false, false).should.be.equal([
			'locals = locals || {};',
			'var __c = locals.__contents || {};',
			'with (locals) {',
			'return (user);',
			'}'
		].join('\n'))
		createCode(tokens2, false, true).should.be.equal('(user)')

		let tokens3 = getTokens('Hello <%= user %>')
		createCode(tokens3, true, false).should.be.equal([
			'locals = locals || {};',
			'var __c = locals.__contents || {};',
			'with (locals) {',
			'return "Hello " + (__l.s=1,__l.e=1,__e(user));',
			'}'
		].join('\n'))
		createCode(tokens3, true, true).should.be.equal('"Hello " + (__l.s=1,__l.e=1,__e(user))')

		let tokens4 = getTokens('<%- user %>')
		createCode(tokens4, true, false).should.be.equal([
			'locals = locals || {};',
			'var __c = locals.__contents || {};',
			'with (locals) {',
			'return (__l.s=1,__l.e=1,(user));',
			'}'
		].join('\n'))
		createCode(tokens4, true, true).should.be.equal('(__l.s=1,__l.e=1,(user))')
	})

	it('should generate multiple statements when needed', function () {
		let tokens = getTokens('<% if (true) { %>true<% } %>')
		createCode(tokens, false, false).should.be.equal([
			'locals = locals || {};',
			'var __c = locals.__contents || {};',
			'with (locals) {',
			'var __o = "";',
			'if (true) {',
			'__o += "true";',
			'}',
			'return __o;',
			'}'
		].join('\n'))
		createCode(tokens, false, true).should.be.equal([
			'(function () {',
			'var __o = "";',
			'if (true) {',
			'__o += "true";',
			'}',
			'return __o;',
			'})()'
		].join('\n'))

		let tokens2 = getTokens('<% if (true) { %>true<% } %>')
		createCode(tokens2, true, false).should.be.equal([
			'locals = locals || {};',
			'var __c = locals.__contents || {};',
			'with (locals) {',
			'var __o = "";',
			'__l.s = 1;',
			'__l.e = 1;',
			'if (true) {',
			'__o += "true";',
			'__l.s = 1;',
			'__l.e = 1;',
			'}',
			'return __o;',
			'}'
		].join('\n'))
		createCode(tokens2, true, true).should.be.equal([
			'(function () {',
			'var __o = "";',
			'__l.s = 1;',
			'__l.e = 1;',
			'if (true) {',
			'__o += "true";',
			'__l.s = 1;',
			'__l.e = 1;',
			'}',
			'return __o;',
			'})()'
		].join('\n'))
	})

})

function getTokens(source) {
	return ejs.reduce(ejs.parse(source))
}