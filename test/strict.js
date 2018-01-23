/* globals describe, it*/
'use strict'

let compile = require('..').compile
require('should')

describe('strict', () => {
	it('should compile in strict mode by default', () => {
		compile('<% this.x = 1 %>').should.throw(/Cannot set property/)

		// eslint-disable-next-line no-new-func
		let render = new Function('locals, renderCustom', compile.standAlone('<% this.x = 2 %>'))
		render.should.throw(/Cannot set property/)
	})

	it('should compile in sloppy mode', () => {
		compile('<% this.x = 3 %>', {
			strictMode: false
		})()
		global.x.should.be.equal(3)

		// eslint-disable-next-line no-new-func
		let render = new Function('locals, renderCustom', compile.standAlone('<% this.x = 4 %>', {
			strictMode: false
		}))
		render()
		global.x.should.be.equal(4)
	})
})