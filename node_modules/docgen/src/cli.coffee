
info = require "#{__dirname}/../package"
parameters = require 'parameters'
docgen = require '..'

###
`cli([argv], callback)`
###
module.exports = (argv, callback) ->
  if arguments.length is 1
    callback = argv
    argv = null
  params = parameters(
    name: info.name
    description: info.description
    options: [
      name: 'version'
      shortcut: 'v'
      type: 'boolean'
      description: 'Print the version number'
    ,
      name: 'language'
      shortcut: 'l'
      description: 'Language of the file, default to "en"'
    ,
      name: 'source'
      shortcut: 's'
      description: 'One or multiple files and patterns separated by commas'
    ,
      name: 'destination'
      shortcut: 'd'
      description: 'Output directory'
    ]
  )
  options = params.parse argv or process

  if options.version
    callback null, "#{info.name} #{info.version}\n#{info.description}\n"
    return

  return callback null, params.help() if options.help or not options.source

  docgen options, callback
