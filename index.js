var util = require('util');
var fs = require('fs');
var async = require('async');
var ApkReader = require('adbkit-apkreader');
var request = require('request');
var parser = require('url');
var zlib = require('zlib');
var md5 = require('MD5');

refresh = function() {
    //scan dir
    var apks = fs.readdirSync('apks');
    //async loop
    async.eachSeries(apks, function(apk, cback) {
        try {
            //check version
            var reader = ApkReader.readFile('apks/' + apk);
            var manifest = reader.readManifestSync();
            var version = manifest.versionCode;
            var name = manifest['package'];
            //get new link and md5
            httpGET("http://apps.evozi.com/apk-downloader/?id=" + name, function(data) {
                var postData = {};
				//find token name
				//console.log(data);
				//console.log(re.exec(data));
				//console.log(data);
				var re = /,  t:.*?,(.*)\: ?/;
				var tokanName = re.exec(data)[1].split(':')[0].trim();
				//console.log(tokanName);
				re = new RegExp(",  t: (.*),.*"+tokanName);
                var found = re.exec(data);
				//console.log(data);
                postData.t = found[1];
				re = new RegExp(tokanName+":(.*),");
                found = re.exec(data);
                var token = found[1].trim();
                re = new RegExp("var " + token + " = '(.*)'");
                found = re.exec(data);
                postData[tokanName] = found[1];
                postData.packagename = name;
                postData.fetch = false;
                //console.log(postData);
                httpPOST("http://api.evozi.com/apk-downloader/download", postData, function(data) {
                    remote = JSON.parse(data);
                    //console.log(remote);
                    if (remote.status !== 'error') {
                        if (remote.version_code <= version) {
                            console.log('[Hit] ..... ' + apk);
                            cback();
                        } else {
                            //console.log(remote);
                            process.stdout.write('[updating] ..... ' + apk + ',fileSize :' + remote.filesize + '... ');
                            //TIME TO DOWNLOAD
                            downloadApk(remote.url, function() {
                                //check md5
                                fs.readFile('tmpApk.apk', function(err, buf) {
                                    if (remote.md5 == md5(buf)) {
                                        //delete old file
                                        fs.unlinkSync('apks/' + apk);
                                        //move new file
                                        fs.renameSync('tmpApk.apk', 'apks/' + name + '.apk');
                                        console.log('DONE');
                                        cback();
                                    } else {
                                        console.log('[error : md5 Mismatch] ..... ' + apk);
                                        fs.unlinkSync('tmpApk.apk');
                                        cback();
                                    }

                                });

                            });

                        }
                    } else {
                        console.log('[error (limit exceeded or package not found) ] ..... ' + apk);
                        cback();
                    }
                }, function() {
                    console.log('[fail] ..... ' + apk);
                    cback();
                });
            }, function() {
                console.log('[fail] ..... ' + apk);
                cback();
            });

        } catch (e) {
            console.log('[invalid] ..... ' + apk);
            cback();
        }
    }, function(err) {
        console.log('[all done]');
        // if any of the saves produced an error, err would equal that error
    });
}


var requestWithEncoding = function(type, options, callback) {
    //console.log(type+" url : "+options.url);
    if (type == 'post') {
        //console.log(options);
        var req = request.post(options);
    } else {
        var req = request.get(options);
    }
    req.on('response', function(res) {
        var chunks = [];
        res.on('data', function(chunk) {
            chunks.push(chunk);
        });

        res.on('end', function() {
            var buffer = Buffer.concat(chunks);
            var encoding = res.headers['content-encoding'];
            if (encoding == 'gzip') {
                zlib.gunzip(buffer, function(err, decoded) {
                    //console.log(decoded && decoded.toString());
                    callback(err + '', decoded && decoded.toString());
                });
            } else if (encoding == 'deflate') {
                zlib.inflate(buffer, function(err, decoded) {
                    callback(err + '', decoded && decoded.toString());
                })
            } else {
                callback('null', buffer.toString());
            }
        });
    });
    req.on('error', function(err) {
        callback(err);
    });
}


httpGET = function(url, success, fail) {
    var headers = {
        "accept-charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
        "accept-language": "en-US,en;q=0.8",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2",
        "accept-encoding": "gzip,deflate",
    };

    var options = {
        url: url,
        headers: headers
    };

    requestWithEncoding('get', options, function(err, data) {
        if (err !== 'null') fail(err);
        if (data == undefined || data == "" || data.indexOf("unavailable") == 1) {
            fail('invalid response');
        } else {
            success(data);
        }
    });
}


httpPOST = function(url, data, success, fail) {
    var headers = {
        "accept-charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
        "accept-language": "en-US,en;q=0.8",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2",
        "accept-encoding": "gzip,deflate",
    };

    var options = {
        url: url,
        headers: headers,
        form: data
    };

    requestWithEncoding('post', options, function(err, data) {
        if (err !== 'null') fail(err);
        if (data == undefined || data == "" || data.indexOf("unavailable") == 1) {
            fail('invalid response');
        } else {
            success(data);
        }
    });
}



downloadApk = function(url, callback) {
    var fname = 'tmpApk.apk';
    var fullname = fname;

    var ws = fs.createWriteStream(fullname);
    ws.on('close', function() {
        callback();
    });
    request(url).pipe(ws);
};
refresh();
