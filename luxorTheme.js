/* jshint node: true */
"use strict";


var rp = require('request-promise');
var Promise = require('bluebird');
var Accessory, Characteristic, Service, UUIDGen, homebridge, controller;

var LuxorTheme = function(accessory, log, Homebridge, Controller) {

  var self = this;

  homebridge = Homebridge;
  controller = Controller;

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Characteristic = homebridge.hap.Characteristic;
  Service = homebridge.hap.Service;
  UUIDGen = homebridge.hap.uuid;

  self.Name = 'Luxor Theme ' + accessory.displayName;

  self.accessory = accessory;
  self.log = log;

  // Plugin can save context on accessory
  // To help restore accessory in configureAccessory()
  //self.accessory.context.ip_addr = ip_addr;
  //self.accessory.context.themeIndex = group;

  self.log(self.Name + ': initializing %s Luxor Theme %s', self.accessory.context.status, self.accessory.displayName);


  // Make sure you provided a name for service otherwise it may not visible in some HomeKit apps.
  if (self.accessory.context.status === 'new') {
    // set the accessory to reachable if plugin can currently process the accessory
    // otherwise set to false and update the reachability later by invoking
    // accessory.updateReachability()
    accessory.reachable = true;

    //self.accessory.context.brightness = brightness;
    //self.accessory.context.binaryState = brightness > 0 ? 1 : 0;

    self.accessory.addService(Service.Switch, self.accessory.displayName);
    self.accessory.getService(Service.Switch)
      .getCharacteristic(Characteristic.On)
      .on('get', self.getPower.bind(this))
      .on('set', self.setPower.bind(this));


    self.accessory.getService(Service.AccessoryInformation, self.accessory.displayName)
      .setCharacteristic(Characteristic.Manufacturer, "Luxor")
      .setCharacteristic(Characteristic.Model, "Theme");

    self.accessory.context.status = 'current';
  } else {
    // Process cached accessories here

    if (self.accessory.getService(Service.Switch)) {
      self.accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on('get', self.getPower.bind(this))
        .on('set', self.setPower.bind(this));
    }

    self.accessory.context.status = 'current';
  }

  self.accessory.on('identify', function(paired, callback) {
    // we return the callback first because Home (and other apps)
    // are now calling this immediately upon the accessory setup screen.
    // This allows the process to continue without needing to wait 9 seconds
    // for the lights to cycle
    callback();

    return Promise.resolve()
      .then(function() {
        self.log(self.Name + ' :Identifying %s.  (Nothing will happen for themes.).', accessory.displayName);
        //return self.setPower(1, function() {});
      })
      // .delay(3000)
      // .then(function() {
      //   return self.setPower(0, function() {});
      // })
      // .delay(3000)
      // .then(function() {
      //   return self.setPower(1, function() {});
      // })
      // .delay(3000)
      // .then(function() {
      //   return self.setPower(0, function() {});
      // })
      //  .then(function() {
      //      return callback();
      //  })
      .catch(function(err) {
        self.log.error('Error identifying theme', self.accessory.displayName);
      });
  });
  // self.pollingBrightness();
    self.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(0);

};

LuxorTheme.prototype.getPower = function(callback) {
  var self = this;
  //self.log.debug("Getting power state for: ", self.accessory.displayName);
  //self.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On);
  callback(null, self.accessory.context.binaryState);
  //self.getCurrentState(callback);
};

LuxorTheme.prototype.setPower = function(powerOn, callback) {
  var self = this;
  if (self.accessory.context.binaryState === powerOn) {
    self.log('Not changing power to %s because it is already %s', powerOn === 1 ? 'On' : 'Off', self.accessory.context.binaryState === 1 ? 'On' : 'Off');
    callback();

  } else {

    return self.illuminateTheme(callback, powerOn ? 1 : 0);

  }

};


LuxorTheme.prototype.pollingBrightness = function() {
  var self = this;
  self.getPower(function() {
    // self.log.debug('Polled %s for change in brightness.', self.accessory.displayName);
  });

  setTimeout(self.pollingBrightness.bind(this), 30 * 1000);
};


// LuxorTheme.prototype.fiveSecondTimer = function() {
//   //var self = this;
//   console.log("what is this?? ", this);
//       this.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(0);
//       this.accessory.context.binaryState = 0;
//
// };

LuxorTheme.prototype.illuminateTheme = function(callback, onOff) {
  var self = this;

  return Promise.resolve()
    .then(function() {
      if (self.accessory.context.themeIndex < 24) {
        return controller.IlluminateTheme(self.accessory.context.themeIndex, onOff);
      } else if (self.accessory.context.themeIndex === 24) {
        //all off
        return controller.ExtinguishAll();
      } else if (self.accessory.context.themeIndex === 25) {
        //all on
        return controller.IlluminateAll();
      }
    })
    .then(function(result) {
      self.accessory.context.binaryState = onOff;

      self.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(onOff > 0 ? 1 : 0);
      if (onOff === 1) {
        setTimeout(function() {
          self.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(0);
          self.accessory.context.binaryState = 0;
        }, 5 * 1000);
      }
      return result;
    })
    .then(function(result) {
      callback(null, result);
      return self.log(self.Name + ': Successfully set %s power to %s. %s ', self.accessory.displayName, (onOff === 0 ? "0 (Off)" : "On"), result === "Ok" ? '' : result);

    })
    .catch(function(err) {
      throw new Error(self.accessory.displayName + " Crash! Error calling controller.IlluminateTheme for Theme %s: ", self.accessory.context.themeIndex, onOff, err);
    });
};

LuxorTheme.prototype.returnTheme = function(info) {
  var self = this;
  return Promise.resolve()
    .then(function() {
      for (var index in info.ThemeList) {
        if (info.ThemeList[index].ThemeIndex === self.accessory.context.themeIndex) {
          return info.ThemeList[index];
        }
      }
    });
};


LuxorTheme.prototype.getCurrentState = function(callback) {
  var self = this;

  return controller.ThemeListGet()
    .then(function(info) {
      return self.returnTheme(info);
    })
    .then(function(theme) {
      console.log('return: ' + theme);
      if (self.accessory.context.binaryState !== theme.OnOff) {
        self.accessory.context.binaryState = theme.OnOff; // This Luxor array starts at 0.  (Lights start at 1)
        self.log(self.Name + ': Current status of theme %s is %s', self.accessory.displayName, self.accessory.context.binaryState === 1 ? "On" : "Off");
      }

      callback(null, self.accessory.context.binaryState);
      self.log.debug(self.Name + ': Retrieved theme status: %s', self.accessory.context.binaryState);

      // homekit wasn't updating the values with just the callback, so explicitly calling these here.
      self.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(self.accessory.context.binaryState);


      return self.accessory.context.binaryState;
    })
    .catch(function(err) {
      callback(err);
      self.log.error(self.accessory.displayName + ": Not able to retrieve the theme.  Error: " + err);
    });
};

module.exports = LuxorTheme;
