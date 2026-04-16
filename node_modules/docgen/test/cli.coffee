
cli = require '../lib/cli'
require 'should'

describe 'cli', ->

  it 'should print help if source is not defined', ->
    cli [], (err, help) ->
      help.should.eql """
      NAME
          docgen - Generate documentation from markdown comments in your source code
      SYNOPSIS
          docgen [options...]
      DESCRIPTION
          -v --version        Print the version number
          -l --language       Language of the file, default to "en"
          -s --source         One or multiple files and patterns separated by commas
          -d --destination    Output directory
          -h --help           Display help information
      EXAMPLES
          docgen --help     Show this message

      """

  it 'should throw error if source does not exist', ->
    cli ['-s', './toto'], (err) ->
      err.message.should.eql 'Invalid source "./toto"'


