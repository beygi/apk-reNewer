var util = require('util');
var ApkReader = require('adbkit-apkreader');

var reader = ApkReader.readFile('Twitter.apk');
var manifest = reader.readManifestSync();

console.log(util.inspect(manifest, { depth: null }));
