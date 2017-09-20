/* jshint node: true */

"use strict";

var Accessory, Characteristic, Service, UUIDGen, Homebridge;


var rp = require('request-promise');
var luxorZDLight = require('./luxorZDLight.js');
var luxorZDCLight = require('./luxorZDCLight.js');
var Promise = require('bluebird');



module.exports = LuxorZDController;


function getStatus(result) {
  switch (result) {
    case 0:
      return ('Ok'); //StatusOk
    case (1):
      return ('Unknown Method'); //StatusUnknownMethod
    case (101):
      return ('Unparseable Request'); //StatusUnparseableRequest
    case (102):
      return ('Invalid Request'); //StatusInvalidRequest
    case (201):
      return ('Precondition Failed'); //StatusPreconditionFailed
    case (202):
      return ('Group Name In Use'); //StatusGroupNameInUse
    case (205):
      return ('Group Number In Use'); //StatusGroupNumberInUse
    case (243):
      return ('Theme Index Out Of Range'); //StatusThemeIndexOutOfRange
    default:
      return ('Unknown status');
  }
}


function LuxorZDController(ip, log) {
  this.ip = ip;
  this.log = log;
  log.info('Assigning ZD Controller to IP %s', this.ip);
}

LuxorZDController.prototype.IlluminateAll = function() {
  // Turn on all lights
  var self = this;
  self.log.debug('Turning on all lights');

  var post_options = {
    url: 'http://' + self.ip + '/IlluminateAll.json',
    method: 'POST'
  };
  return rp(post_options)
    .then(function(body) {
      var result = getStatus(JSON.parse(body).Status);

      return result;
    })
    .catch(function(err) {
      self.log.error('was not able to turn on all lights.', err);
    });
};

LuxorZDController.prototype.ExtinguishAll = function() {
  // Turn on all lights
  var self = this;
  self.log.debug('Turning of all lights');

  var post_options = {
    url: 'http://' + self.ip + '/ExtinguishAll.json',
    method: 'POST'
  };
  return rp(post_options)
    .then(function(body) {
      var result = getStatus(JSON.parse(body).Status);

      return result;
    })
    .catch(function(err) {
      self.log.error('was not able to turn off all lights.', err);
    });
};

LuxorZDController.prototype.GroupListGet = function() {
  // Get the list of light groups from the controller
  var self = this;
  self.log.debug('Retrieving light groups from controller');

  var post_options = {
    url: 'http://' + self.ip + '/GroupListGet.json',
    method: 'POST'
  };
  return rp(post_options)
    .then(function(body) {
      return JSON.parse(body);
    })
    .catch(function(err) {
      self.log.error('was not able to retrieve light groups from controller.', err);
    });
};

LuxorZDController.prototype.IlluminateGroup = function(groupNumber, desiredIntensity) {
  var self = this;
  var requestData = JSON.stringify({
    'GroupNumber': groupNumber,
    'Intensity': desiredIntensity
  });

  var rpOptions = {
    url: 'http://' + self.ip + '/IlluminateGroup.json',
    method: "POST",
    body: requestData,
    headers: {
      'cache-control': 'no-cache',
      'content-type': 'text/plain',
      'Content-Length': Buffer.byteLength(requestData)
    }
  };
  return rp(rpOptions)
    .then(function(body) {
      var result = getStatus(JSON.parse(body).Status);
      if (result === "Ok") {
        return result;
      } else {
        throw new Error(result);
      }
    })
    .catch(function(err) {
      throw new Error(err);
    });
};
