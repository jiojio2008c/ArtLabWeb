# node-backmeup


## Usage

```js
var backmeup = require('backmeup');

backmeup.backup({
  source: '/etc' | ['/etc/' , '/home/file1']
  destination: '/tmp'
  archive: false (true by default)
  filename: 'toto.tgz' (filename of archive if true, timestamp by default)
  compress: true (false by default, ignored if archive is false)
  algorithm: 'gzip | bzip2 | lzma' (gzip by default)
  cleanup: true (false by default, will delete source)
}, function(err, info){
  info.filename.should.eql('etc-*.tgz');
});
```