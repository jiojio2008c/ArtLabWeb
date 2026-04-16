
should = require 'should'
fs = require 'fs'
path = require 'path'
glob = require 'glob'
docgen = require "../#{if process.env.DOCGEN_COV then 'lib-cov' else 'src'}"

describe 'docgen', ->

  files = glob.sync "#{__dirname}/resources/*.coffee"
  for file in files then do (file) ->
    basename = "#{path.basename file, '.coffee'}"
    return if basename is 'index'
    it "generate #{basename}", (next) ->
      fs.readFile "#{__dirname}/resources/#{basename}.md", (err, md) ->
        should.not.exist err
        docgen source: file, date: '2013-01-09T19:44:24.052Z', (err, gen) ->
          should.not.exist err
          gen.toString().should.eql md.toString()
          next()
