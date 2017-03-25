/* jshint node: true */
"use strict";


var rp = require('request-promise');
var Promise = require('bluebird');
var Accessory, Characteristic, Service, UUIDGen;

var LuxorAccessory = function(accessory, ip_addr, group, brightness, status, log, _Accessory, _Characteristic, _Service, _UUIDGen) {
    var self = this;

    // Accessory must be created from PlatformAccessory Constructor
    Accessory = _Accessory;

    // Service and Characteristic are from hap-nodejs
    Characteristic = _Characteristic;
    Service = _Service;
    UUIDGen = _UUIDGen;
    self.Name = 'ZD Accessory';

    self.accessory = accessory;
    self.log = log;

    self.ip_addr = ip_addr;
    self.groupNumber = group;

    self.log(self.Name + ': initializing %s ZD light %s', status, self.accessory.displayName);

    self.selfcall = false;

    // Plugin can save context on accessory
    // To help restore accessory in configureAccessory()
    accessory.context.group = group;


    // Make sure you provided a name for service otherwise it may not visible in some HomeKit apps.
    if (status === 'new') {
        // set the accessory to reachable if plugin can currently process the accessory
        // otherwise set to false and update the reachability later by invoking
        // accessory.updateReachability()
        accessory.reachable = true;

        self.brightness = brightness;
        self.binaryState = brightness > 0 ? 1 : 0;

        self.lightBulbService = self.accessory.addService(Service.Lightbulb, self.accessory.Name);

        self.lightBulbService.getCharacteristic(Characteristic.On)
            .on('get', self.getPower.bind(this))
            .on('set', self.setPower.bind(this));

        self.lightBulbService.getCharacteristic(Characteristic.Brightness)
            .on('set', self.setBrightness.bind(this))
            .on('get', self.getBrightness.bind(this));

        self.accessoryService = self.accessory.getService(Service.AccessoryInformation);
        self.accessoryService.setCharacteristic(Characteristic.Manufacturer, "Luxor");
        self.accessoryService.setCharacteristic(Characteristic.Model, "ZD");

    } else {
        // Process cached accessories here

        // do not allow accessing of accessory until we finish processing the cached
        // and making sure it is valid
        accessory.reachable = false;

        if (accessory.getService(Service.Lightbulb)) {
            accessory.getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.On)
                .on('get', self.getPower.bind(this))
                .on('set', self.setPower.bind(this));

            accessory.getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Brightness)
                .on('set', self.setBrightness.bind(this))
                .on('get', self.getBrightness.bind(this));
        }
    }

    accessory.on('identify', function(paired, callback) {
        return Promise.resolve()
            .then(function() {
                self.log(self.Name + ' :Identifying %s.  Lights should flash twice.', accessory.displayName);
                return self.setPower(1, function() {});
            })
            .delay(3000)
            .then(function() {
                return self.setPower(0, function() {});
                })
            .delay(3000)
            .then(function() {
                return self.setPower(1, function() {});
            })
            .delay(3000)
            .then(function() {
                return self.setPower(0, callback);
            })
          //  .then(function() {
          //      return callback();
          //  })
            .catch(function(err) {
                self.log.error('Error identifying accessory', self.accessary.displayName);
            });
    });
};

LuxorAccessory.prototype.getPower = function(callback) {
    var self = this;
    self.log.debug("Getting power state for: ", self.accessory.displayName);
    self.getCurrentState(callback, "power");
};

LuxorAccessory.prototype.setPower = function(powerOn, callback) {
    var self = this;
    if (self.selfcall) {
      self.selfcall = false;
      return callback();
    }
    if (self.binaryState === powerOn) {
        self.log.debug('Not changing power to %s because it is already %s', powerOn, self.binaryState);

    } else {
        self.binaryState = powerOn ? 1 : 0;
        // self.log.debug("Attempting to set Power for the %s to %s", self.accessory.displayName, self.binaryState == 1 ? "on " : "off");
        if (powerOn === 1) {
          self.selfcall = true;
            self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.Brightness, 100);
        } else {
          self.selfcall = true;
            self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.Brightness, 0);
        }
        self.illuminateGroup(callback, self.binaryState * 100); //set to 0 if we want to turn off, or 50 if we want to turn on.
    }
};

LuxorAccessory.prototype.getBrightness = function(callback) {
    var self = this;
    return Promise.resolve()
        .then(function() {
            return self.getCurrentState(callback, "brightness");
        })
        .then(function() {
            if (self.accessory.reachable === false) {
                // this is here because we set cached accessory reachable=false until we update the brightness
                self.accessory.updateReachability(true);
            }
            return;
        })
        .catch(function(err) {
            self.log.error(self.Name + ': Error Updating Brightness', err);
        });
};

LuxorAccessory.prototype.setBrightness = function(brightness, callback) {
    var self = this;
    if (self.selfcall) {
      self.selfcall = false;
      return callback();
    }
    return Promise.resolve()
        .then(function() {
            // self.log.debug("Attempting to Set Brightness for the '%s' to %s", self.accessory.displayName, brightness);
            if (brightness === 0) {
              self.selfcall = true;
              self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.On, 0);
            } else {
              self.selfcall = true;
              self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.On, 1);
            }
            return self.illuminateGroup(callback, brightness);
        })
        .catch(function(err) {
            self.log.error(self.Name + ': Error attempting to set brightness.', err);
        });
};


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

LuxorAccessory.prototype.illuminateGroup = function(callback, desiredIntensity) {
    var self = this;
    var requestData = JSON.stringify({
        'GroupNumber': self.groupNumber,
        'Intensity': desiredIntensity
    });

    var rpOptions = {
        url: 'http://' + self.ip_addr + '/IlluminateGroup.json',
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
            if (result == "Ok") {
                self.brightness = desiredIntensity;
                self.binaryState = (self.brightness) > 0 ? 1 : 0;
                return result;
            } else {
                throw new Error(this.Name + ': Something went wrong!  Request to set %s brightness to %s: %s ', self.accessory.displayName, desiredIntensity, result);
            }
        })
        .then(function(result) {
            callback();
          return self.log(self.Name + ': Successfully set %s brightess to %s: %s ', self.accessory.displayName, (desiredIntensity === 0 ? "0 (Off)" : desiredIntensity), result);
        })
        .catch(function(err) {
            throw new Error(self.accessory.displayName + " Crash! Error: " + err);
        });
};

LuxorAccessory.prototype.getCurrentState = function(callback, whichcall) {
    var self = this;
    self.log.debug(self.Name + ': Retrieving %s of light group %s %s', whichcall, self.groupNumber, self.accessory.displayName);

    var post_options = {
        url: 'http://' + self.ip_addr + '/GroupListGet.json',
        method: 'POST'
    };

    return rp(post_options)
        .then(function(body) {
            var info = JSON.parse(body);
            self.brightness = info.GroupList[self.groupNumber - 1].Intensity; // JS arrays start at 0 while luxor numbering starts at 1
            self.binaryState = self.brightness > 0 ? 1 : 0;
            self.log(self.Name + ': Current %s of light group %s is %s', whichcall, self.accessory.displayName, (whichcall == "brightness" ? self.brightness : (self.binaryState == 1 ? "On" : "Off")));
            if (whichcall == "brightness") {
                callback(null, self.brightness);
            } else if (whichcall == "power") {
                callback(null, self.binaryState);
            } else {
                throw new Error(self.accessory.displayName + " Invalid Characteristic: ", whichcall);
            }
            return self.binaryState;
        })
        .catch(function(err) {
            callback(err);
            self.log.error(self.accessory.displayName + ": Not able to connect to the controller.  Error: " + err);
        });
};

module.exports = LuxorAccessory;
