/**
 * Created by Rain on 2016/9/2.
 */
var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var Busboy = require('busboy');
var mkdirp = require('mkdirp');
var is = require('type-is');
var qs = require('qs');

module.exports = function (options) {
  options = options || {};
  options.includeEmptyFields = options.includeEmptyFields || false;
  options.inMemory = options.inMemory || false;
  options.putSingleFilesInArray = options.putSingleFilesInArray || false;

  var dest;

  // 如果这个文件上传目标路径不存在，就上传到系统临时目录上去
  if (options.dest) {
    dest = options.dest;
  } else {
    dest = os.tmpdir();
  }

  //文件保存，则创建路径
  mkdirp(dest, function (err) {
    if (err) throw err;
  });

  // 给默认的上传文件路径
  var changeDest = options.changeDest || function (dest, req, res) {
        return dest;
      };

  // 默认给上传的文件重命名
  var rename = options.rename || function (fieldname, filename, req, res) {
        var random_string = fieldname + filename + Date.now() + Math.random();
        return crypto.createHash('md5').update(random_string).digest('hex');
      };

  return function (req, res, next) {
    var readFinished = false;
    var fileCount = 0;

    req.body = req.body || {};
    req.files = req.files || {};

    //推断http请求的类型，如果不是文件上传，直接跳过
    if (is(req, ['multipart'])) {
      if (options.onParseStart) {
        options.onParseStart();
      }

      // 添加req的headers到options上
      options.headers = req.headers;

      var busboy = new Busboy(options);
      // 解析post 表单中的字段
      busboy.on('field', function (fieldname, val, valTruncated, keyTruncated) {
        // 字段为空是否 处理
        if (!options.includeEmptyFields && !val) return;

        if (req.body.hasOwnProperty(fieldname)) {
          if (Array.isArray(req.body[fieldname])) {
            req.body[fieldname].push(val);
          } else {
            req.body[fieldname] = [req.body[fieldname], val];
          }
        } else {
          req.body[fieldname] = val;
        }
      });

      // 解析post表单中的文件（字段名，流，文件名，格式，类型）
      busboy.on('file', function (fieldname, fileStream, filename, encoding, mimetype) {
        //拓展名，文件名，文件路径
        var ext, newFilename, newFilePath;

        // 如果没有文件名，就不附加文件对象
        if (!filename) return fileStream.resume();

        // 定义正在处理的新文件分片数量
        fileCount++;

        //截取文件的拓展名
        if (filename.indexOf('.') > 0) {
          ext = '.' + filename.split('.').slice(-1)[0];
        } else {
          ext = '';
        }

        //重名文件名（name+ext） 和上传的路径（dest+newFileName）
        newFilename = rename(fieldname, filename.replace(ext, ''), req, res) + ext;
        newFilePath = path.join(changeDest(dest, req, res), newFilename);

        var file = {
          fieldname: fieldname,
          originalname: filename,
          name: newFilename,
          encoding: encoding,
          mimetype: mimetype,
          path: newFilePath,
          extension: (ext === '') ? '' : ext.replace('.', ''),
          size: 0,
          truncated: null,
          buffer: null
        };

        // 文件开始上传时触发
        if (options.onFileUploadStart) {
          var proceed = options.onFileUploadStart(file, req, res);
          // if the onFileUploadStart handler returned null, it means we should proceed further, discard the file!
          if (proceed == false) {
            fileCount--;
            return fileStream.resume();
          }
        }

        var bufs = [];
        var ws;

        //如果不是内存存储，根据filePath创建输出流
        if (!options.inMemory) {
          ws = fs.createWriteStream(newFilePath);
          fileStream.pipe(ws);
        }

        //给可读流添加一个读取监听事件(可以添加多个监听时间）
        fileStream.on('data', function (data) {
          if (data) {
            if (options.inMemory) bufs.push(data);//如果是内存操作，向内存中写入
            file.size += data.length;//统计当前上传大小
          }
          //上传数据时触发（）
          if (options.onFileUploadData) {
            options.onFileUploadData(file, data, req, res);
          }
        });

        function onFileStreamEnd() {
          file.truncated = fileStream.truncated;
          if (!req.files[fieldname]) {
            req.files[fieldname] = [];
          }
          if (options.inMemory) file.buffer = Buffer.concat(bufs, file.size);//如果是内存模式，给对应字段一个buffer字段，用于流操作
          req.files[fieldname].push(file);

          // trigger "file end" event
          if (options.onFileUploadComplete) {
            options.onFileUploadComplete(file, req, res);
          }

          // defines has completed processing one more file
          fileCount--;
          onFinish();
        }

        //根据内存模式启动不同的流操作
        if (options.inMemory)
          fileStream.on('end', onFileStreamEnd);//可读流 end
        else
          ws.on('finish', onFileStreamEnd); //写入流 finish

        fileStream.on('limit', function () {
          if (options.onFileSizeLimit) {
            options.onFileSizeLimit(file);
          }
        });

        fileStream.on('error', function (error) {
          // trigger "file error" event
          if (options.onError) {
            options.onError(error, next);
          } else {
            next(error);
          }
        });

        function onFileStreamError(error) {
          // trigger "file error" event
          if (options.onError) {
            options.onError(error, next);
          }
          else next(error);
        }

        if (options.inMemory)
          fileStream.on('error', onFileStreamError);
        else
          ws.on('error', onFileStreamError);

      });

      busboy.on('partsLimit', function () {
        if (options.onPartsLimit) {
          options.onPartsLimit();
        }
      });

      busboy.on('filesLimit', function () {
        if (options.onFilesLimit) {
          options.onFilesLimit();
        }
      });

      busboy.on('fieldsLimit', function () {
        if (options.onFieldsLimit) {
          options.onFieldsLimit();
        }
      });

      busboy.on('finish', function () {
        readFinished = true;
        onFinish();
      });

      /**
       * 将控制权传递给下一个中间件
       * 只有在读/写流完成时才会结束
       */
      var onFinish = function () {
        if (!readFinished || fileCount > 0) return;

        if (!options.putSingleFilesInArray) {
          for (var field in req.files) {
            if (req.files[field].length === 1) {
              req.files[field] = req.files[field][0];
            }
          }
        }

        // 调整body 结构，和增强安全 ,其实它这个qs 模块，我不知道干啥的
        req.body = qs.parse(req.body);

        // 当form 解析完成, 将控制权交给下一个控制权,可以自己定义结束函数，但是必须next将控制权抛出
        if (options.onParseEnd) {
          options.onParseEnd(req, next);
        }
        else {
          next();
        }
      };

      req.pipe(busboy);
    } else {
      return next();
    }
  }
};