/*globals describe, it*/
'use strict'

let escape = require('../lib/escape')
require('should')

describe('parse', function () {
	it('should escape html', function () {
		escape.html('a && b << c >> d "" e \'\' f').should.be
			.equal('a &amp;&amp; b &lt;&lt; c &gt;&gt; d &#34;&#34; e &#39;&#39; f')
	})

	it('should escape js value to put inside double quotes', function () {
		escape.js('a \\\\ b \n\n c \r\r d "" e').should.be
			.equal('a \\\\\\\\ b \\n\\n c \\r\\r d \\"\\" e')
	})
})