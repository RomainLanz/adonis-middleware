'use strict'

/**
 * adonis-middleware
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

/*
|--------------------------------------------------------------------------
| SAMPLE CONFIG
|--------------------------------------------------------------------------
|
| module.exports = {
|  bodyParser: {
|    limit: '1mb',
|    strict: true,
|    qs: {
|      depth: 5,
|      parameterLimit: 1000,
|      delimiter: '&',
|      allowDots: false
|    },
|    uploads: {
|      multiple: true,
|      hash: false,
|      maxSize: '2mb'
|    }
|  }
| }
|
*/

const formidable = use('formidable')
const coBody = use('co-body')
const bytes = use('bytes')

/**
 * list of content types to be used for
 * parsing request body
 *
 * @type {Object}
 */
const contentTypes = {
  json: [
    'application/json',
    'application/json-patch+json',
    'application/vnd.api+json',
    'application/csp-report'
  ],
  form: ['application/x-www-form-urlencoded'],
  multipart: ['multipart/form-data'],
  text: ['text/plain']
}

class BodyParser {

  constructor (Config) {
    this.config = Config
    this._setQueryStringOptions()
    this._setFormOptions()
    this._setUploadOptions()
  }

  /**
   * wrapper on top of config.get to prepend
   * the base config key everytime.
   *
   * @param  {String} key          [description]
   * @param  {Mixed} defaultValue [description]
   * @return {Mixed}              [description]
   *
   * @private
   */
  _get (key, defaultValue) {
    key = `app.bodyParser.${key}`
    return this.config.get(key, defaultValue)
  }

  /**
   * sets query string options by reading them from
   * config store.
   *
   * @private
   */
  _setQueryStringOptions () {
    this.qs = this._get('qs', {})
  }

  /**
   * sets form options by reading them from
   * config store.
   *
   * @private
   */
  _setFormOptions () {
    this.formOptions = {
      limit: this._get('limit'),
      strict: this._get('strict')
    }
  }

  /**
   * sets file upload options by reading them from
   * config store
   *
   * @private
   */
  _setUploadOptions () {
    this.uploadOptions = {
      maxFieldsSize: bytes.parse(this._get('uploads.maxSize', '4mb')),
      hash: this._get('uploads.hash', false),
      multiple: this._get('uploads.multiple', true),
      maxFields: this._get('qs.parameterLimit', 1000)
    }
  }

  /**
   * parser multipart form data
   *
   * @param  {Object}   request
   * @return {Oject}
   *
   * @private
   */
  _multipart (request) {
    return new Promise(function (resolve, reject) {
      const form = new formidable.IncomingForm()
      form.parse(request.request, function (error, fields, files) {
        if (error) {
          return reject(error)
        }
        resolve({fields, files})
      })
    })
  }

  /**
   * parses request body to fetch post data and form
   * uploads
   *
   * @param  {Object}   form
   * @param  {Object}   request
   * @return {Object}
   *
   * @private
  */
  * _parse (request) {
    let formBody = {
      fields: {},
      files: {},
      raw: null
    }
    if (request.is(contentTypes.json)) {
      formBody.fields = yield coBody.json(request.request, this.formOptions)
    } else if (request.is(contentTypes.form)) {
      formBody.fields = yield coBody.form(request.request, this.formOptions)
    } else if (request.is(contentTypes.text)) {
      formBody.raw = yield coBody.text(request.request, this.formOptions)
    } else if (request.is(contentTypes.multipart)) {
      formBody = yield this._multipart(request, this.uploadOptions)
    }
    return formBody
  }

  /**
   * this method gets called by adonis
   * middleware layer.
   *
   * @param  {Object}   request
   * @param  {Object}   response
   * @param  {Function} next
   * @return {void}
   *
   * @public
   */
  * handle (request, response, next) {
    let formFields = {
      files: {},
      fields: {},
      raw: null
    }
    if (request.hasBody()) {
      formFields = yield this._parse(request)
    }
    request._body = formFields.fields
    request._files = formFields.files
    request._raw = formFields.raw
    yield next
  }
}

module.exports = BodyParser
