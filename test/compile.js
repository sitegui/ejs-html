/*globals describe, it*/
'use strict'

let compile = require('../lib/compile')
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
		compile('Hi <b><%=name.first%></b> <%=name.last%>!', {
			standAlone: true
		})({
			name: {
				first: 'Gui',
				last: 'S'
			}
		}).should.be.equal('Hi <b>Gui</b> S!')
	})
})