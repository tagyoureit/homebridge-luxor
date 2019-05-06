/* jshint node: true */

"use strict";

var util = require('util');
var LuxorZDCController = require('./luxorZDCController.js');

LxtwoController.super_ = LuxorZDCController;

function LxtwoController(ip, log) {
  this.ip = ip;
  this.log = log;
  log.info('ZDC Controller (second gen) @ IP %s initialized', this.ip);
}

util.inherits(LxtwoController, LuxorZDCController);

module.exports = LxtwoController;
