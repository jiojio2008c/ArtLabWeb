
docgen = require '..'
require 'should'

describe 're_title', ->

  it 'should parse underlined title with text', ->
    {title} = docgen.extract """
    This is the title
    =================
    jifoer
    """
    title.should.eql 'This is the title'

  it 'should parse first underlined line', ->
    {title} = docgen.extract """
    jifoer
    This is the title
    =================
    jifoer
    """
    title.should.eql 'This is the title'

