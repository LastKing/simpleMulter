#文件multer上传翻版

抄的multer 0.12.8版本（看清楚，首页就说了。。。）

simple-multer 是一个node.js 中间件 处理上传 multipart/form-data.

封装了busboy


##API

###安装

`$ npm install simple-multer`

###使用

```js
    var express = require('express')
    var multer  = require('multer')
    
    var app = express()
    app.use(multer({ dest: './uploads/'}))
```

你能获得这些字段和文件

```js
console.log(req.body)
console.log(req.files)
```

**重点：** simple-multer 不会处理任何不是multipart/form-data形式的表单

##simple-multer file object 

一个 multer文件对象是一个包含一下属性的文件对象：

1.`fieldname` - 在表单中的字段名
2.`originalname` - 用户计算机上的文件名
3.`name` - 重命名文件名
4.`encoding` - 文件编码类型
5.`mimetype` - 描述文件类型
6.`path` - 本地文件上传的位置
7.`extension` - 文件的拓展
8.`size` - 文件的尺寸
9.`truncated` - 如果限制文件超过限制，将被截断
10.`buffer` - Raw data (是一个空的，除非 inMemory 参数 是真的）

##options
multer 接受一个可选对象，最基本的选项`dest` ，告诉multer上传到哪里。如果你没有填写这个参数，文件将重命名并且上传到系统临时文件夹。
如果`inMemory` 选项为true，数据不会写入硬盘，但是这些数据会保持在文件缓冲区。

在默认情况下，multer 将会重命名文件为了避免文件名冲突，当然这个重命名函数，也能根据你的要求自己的要求重新定义

以下是multer 的可选参数：

* `dest`
* `limits`
* `includeEmptyFields`
* `putSingleFilesInArray`
* `inMemory`
* `rename(fieldname, filename, req, res)`
* `renameDestDir(dest, req, res)`
* `onFileUploadStart(file, req, res)`
* `onFileUploadData(file, data, req, res)`
* `onFileUploadComplete(file, req, res)`
* `onParseStart()`
* `onParseEnd(req, next)`
* `onError()`
* `onFileSizeLimit(file)`
* `onFilesLimit()`
* `onFieldsLimit()`
* `onPartsLimit()`

除了这些，multer 也支持 更多的先进的busboy 选项 比如：highWaterMark,fileHwm and defCharset

在普通 express web app 中，基本实例实例如下：

```js
app.use(multer({
  dest: './uploads/',
  rename: function (fieldname, filename) {
    return filename.replace(/\W+/g, '-').toLowerCase() + Date.now()
  }
}))
```

以下是这些options 参数的细节和解释：

###dest

用于文件上传的路径

###limits

以下可选参数选址了对象的大小限制，这些参数奖直接传给`busboy`,参数的具体解释请查看[busboy's page](https://github.com/mscdex/busboy#busboy-methods)

* `fieldNameSize` - integer - Max field name size (Default: 100 bytes)
* `fieldSize` - integer - Max field value size (Default: 1MB)
* `fields` - integer - Max number of non-file fields (Default: Infinity)
* `fileSize` - integer - For multipart forms, the max file size (in bytes) (Default: Infinity)
* `files` - integer - For multipart forms, the max number of file fields (Default: Infinity)
* `parts` - integer - For multipart forms, the max number of parts (fields + files) (Default: Infinity)
* `headerPairs` - integer - For multipart forms, the max number of header key=>value pairs to parse Default: 2000 (same as node's http).

```js
limits: {
  fieldNameSize: 100,
  files: 2,
  fields: 5
}
```

指定这些limits 能够帮助我们保护网站抵制  denial of service (DoS) attacks.














##req.body Warnings

**警告：** `req.body` 在文件上传之后 完整解析。过早的访问`req.boy`会发生很多错误。`req`和`res`参数被增加到一些functions中，方便程序猿访问。
 例如 session 变量 或者 socket.io 对象。






