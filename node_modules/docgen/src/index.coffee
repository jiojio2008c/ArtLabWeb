
fs = require 'fs'
path = require 'path'
mecano = require 'mecano'
each = require 'each'
parameters = require 'parameters'

###
Find indentation based on the first line containing text
###
getindent = (text) ->
  text = text.split '\n' unless Array.isArray text
  # Find indentation based on the first line containing text
  for line in text
    if line.trim()
      return /(\s*)/.exec(line)[0]
  ''

###
Discover indentation in first line and remove it for every other lines
###
unindent = (lines) ->
  lines = lines.split('\n')
  indent = getindent lines
  # for line in lines
  #   if line.trim()
  #     indent = /(\s*)/.exec(line)[0]
  #     break
  # Remove indentation
  lines = lines.map (line) ->
    line.substr indent.length
  lines.join('\n')

###
Create an anchor from the function name in the title
###
convert_anchor = (text) ->
  re_anchor = /`([\w.]+)\(/g
  text.replace re_anchor, (str, code) ->
    # At least in FF, <a href="" /> doesn't close the tag
    "<a name=\"#{code}\"></a>\n`#{code}("

convert_code = (text) ->
  re_code = /\n(\s{4}\s*?\S[\s\S]*?)\n(?!\s)/g
  text.replace re_code, (str, code) ->
    code = code.split('\n').map((line)->line.substr(4)).join('\n')
    "\n\n```javascript\n#{code}\n```\n\n"

###
docgen(options, callback)
-------------------------

Option is expected to be an object. Only the 
"source" option is required and it may be provided 
as a string or an array. Options include :

*   date
*   source
*   destination
*   jekyll

Provide a source path as an option

    docgen(__filename, funciton(err, md){
      console.log(md);
    });

Jeky example

    docgen({
      jekyll: {
        language: 'en',
        layout: 'page',
        comments: 'false'
        sharing: 'false'
        footer: 'false'
        navigation: 'csv'
        github: 'https://github.com/wdavidw/node-csv-parser'
      }
    })
###
docgen = module.exports = (options, callback) ->
  results = null
  options.date ?= docgen.date()
  unless options.destination?
    options.destination = []
  else unless Array.isArray options.destination
    options.destination = [options.destination] 
  each()
  .files( options.source )
  .parallel( true )
  .on 'item', (source, next) ->
    basename = path.basename source, path.extname source
    fs.readFile source, 'ascii', (err, text) ->
      return callback err if err
      re = /###(.*)\n([\s\S]*?)\n( *)###/g
      match = re.exec text
      {title, content} = docgen.extract match[2]
      content = unindent content
      content = convert_code content
      docs = '---\n'
      docs += "title: \"#{title}\"\n"
      docs += "date: #{options.date}\n"
      for k, v of options.jekyll
        docs += "#{k}: #{v}\n"
      docs += '---\n'
      docs += '\n'
      if content
        docs += content
        docs += '\n'
      while match = re.exec text
        continue if match[1]
        match[2] = unindent match[2]
        docs += '\n'
        docs += convert_code convert_anchor match[2]
        docs += '\n'
      if options.destination.length
        each(options.destination)
        .on 'item', (destination, next) ->
          destination = "#{destination}/#{basename}.md"
          fs.writeFile destination, docs, next
        .on 'both', (err) ->
          next err
      else
        results = [] unless results
        results.push docs
        next()
  .on 'both', (err, count) ->
    return callback err if err
    return callback new Error "Invalid source #{JSON.stringify options.source}" if count is 0
    # destination = options.destination
    # return callback null, results unless destination
    callback null, results
    # each()
    # .files("#{__dirname}/../doc/*.md")
    # .on 'item', (file, next) ->
    #   mecano.copy
    #     source: file
    #     destination: destination
    #     force: true
    #   , next
    # .on 'both', (err) ->
    #   return callback err if err
    #   console.log "Documentation published: #{destination}"
    #   callback null, results

docgen.extract = (text) ->
  match = /(.*\n)?(.+)\n={3,}([\s\S]*)/g.exec text
  title: match[2].trim(), content: match[3].trim()

docgen.date = ->
  (new Date).toISOString()
