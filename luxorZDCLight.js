/* jshint node: true */
"use strict";


var rp = require('request-promise');
var Promise = require('bluebird');

var Accessory, Characteristic, Service, UUIDGen, homebridge, controller;
var desiredHue = -1,
  desiredSaturation = -1; // HomeKit calls Hue/Saturation independently but we need both of them
var desiredHueSatTimer; // timer to clear desired values if we don't get both

var LuxorAccessory = function(accessory, log, Homebridge, Controller) {

  var self = this;

  homebridge = Homebridge;
  controller = Controller;

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Characteristic = homebridge.hap.Characteristic;
  Service = homebridge.hap.Service;
  UUIDGen = homebridge.hap.uuid;

  self.Name = 'ZDC Accessory ' + accessory.displayName;

  self.accessory = accessory;
  self.log = log;

  // Plugin can save context on accessory
  // To help restore accessory in configureAccessory()
  //self.accessory.context.ip_addr = ip_addr;
  //self.accessory.context.groupNumber = group;

  self.log(self.Name + ': initializing %s ZDC light %s', self.accessory.context.status, self.accessory.displayName);


  // Make sure you provided a name for service otherwise it may not visible in some HomeKit apps.
  if (self.accessory.context.status === 'new') {
    // set the accessory to reachable if plugin can currently process the accessory
    // otherwise set to false and update the reachability later by invoking
    // accessory.updateReachability()
    //accessory.reachable = true;

    //self.accessory.context.brightness = brightness;
    //self.accessory.context.binaryState = brightness > 0 ? 1 : 0;
    self.accessory.addService(Service.Lightbulb, self.accessory.displayName);
    self.accessory.getService(Service.Lightbulb)
      .getCharacteristic(Characteristic.On)
      .on('get', self.getPower.bind(this))
      .on('set', self.setPower.bind(this));

    self.accessory.getService(Service.Lightbulb)
      .getCharacteristic(Characteristic.Brightness)
      .on('set', self.setBrightness.bind(this))
      .on('get', self.getBrightness.bind(this));

    self.accessory.getService(Service.Lightbulb)
      .addCharacteristic(Characteristic.Saturation)
      .on('set', self.setSaturation.bind(this))
      .on('get', self.getHueSaturation.bind(this));

    self.accessory.getService(Service.Lightbulb)
      .addCharacteristic(Characteristic.Hue)
      .on('get', this.getHueSaturation.bind(this))
      .on('set', this.setHue.bind(this));

    self.accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "Luxor")
      .setCharacteristic(Characteristic.Model, "ZDC");

    self.accessory.context.status = 'current';
  } else {
    // Process cached accessories here

    // do not allow accessing of accessory until we finish processing the cached
    // and making sure it is valid
    //accessory.reachable = false;

    if (self.accessory.getService(Service.Lightbulb)) {
      self.accessory.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.On)
        .on('get', self.getPower.bind(this))
        .on('set', self.setPower.bind(this));

      self.accessory.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.Brightness)
        .on('set', self.setBrightness.bind(this))
        .on('get', self.getBrightness.bind(this));

      self.accessory.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.Saturation)
        .on('set', self.setSaturation.bind(this))
        .on('get', self.getHueSaturation.bind(this));

      self.accessory.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.Hue)
        .on('set', self.setHue.bind(this))
        .on('get', self.getHueSaturation.bind(this));
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
        return self.setPower(0, function() {});
      })
      //  .then(function() {
      //      return callback();
      //  })
      .catch(function(err) {
        self.log.error('Error identifying accessory', self.accessory.displayName);
      });
  });


  Promise.resolve()
    .then(function() {
      // if the color assignment was changed outside of homekit
      if (self.accessory.context.color !== (250 - self.accessory.context.groupNumber + 1)) {
        // get the "current" list color
        return controller.ColorListGet(self.accessory.context.color)
          .then(function(colors) {
            // assign the current light group to the new group
            desiredHue = colors.Hue;
            desiredSaturation = colors.Sat;
            var oldC = self.accessory.context.color;
            self.accessory.context.color = (250 - self.accessory.context.groupNumber + 1);
            self.log('%s: Copying light palette C%s to color C%s (Hue: %s, Sat: %s)', self.Name, oldC, self.accessory.context.color, desiredHue, desiredSaturation);
            // set the "current" color to the new color
            return self.colorListSet();
          });
      } else {
        // if we are loading again with no change in color outside of homekit
        self.accessory.context.color = (250 - self.accessory.context.groupNumber + 1);
        self.log('%s: Assigning light group to color C%s', self.Name, self.accessory.context.color);
        return;
      }
    })
    .then(function() {
      // set the light group to the newly assigned color.
      return self.groupListEdit();
    })
    .then(function() {
      self.pollingStatus();
      return;
    });




};

LuxorAccessory.prototype.getPower = function(callback) {
  var self = this;
  self.log.debug("Getting power state for: ", self.accessory.displayName);
  self.getCurrentState(callback, "power");
};

LuxorAccessory.prototype.setPower = function(powerOn, callback) {
  var self = this;
  if (self.accessory.context.binaryState === powerOn) {
    self.log('Not changing power to %s because it is already %s', powerOn === 1 ? 'On' : 'Off', self.accessory.context.binaryState === 1 ? 'On' : 'Off');
    callback();

  } else {
    //   self.accessory.context.binaryState = powerOn ? 1 : 0;
    //   // self.log.debug("Attempting to set Power for the %s to %s", self.accessory.displayName, self.accessory.context.binaryState == 1 ? "on " : "off");
    //   if (powerOn === 1) {
    //     self.accessory.getService(Service.Lightbulb)
    //       .getCharacteristic(Characteristic.Brightness)
    //       .updateValue(100);
    //   } else {
    //     self.accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).updateValue(0);
    //   }
    return self.illuminateGroup(callback, powerOn ? 100 : 0, "power"); //set to 0 if we want to turn off, or 50 if we want to turn on.
  }
};

LuxorAccessory.prototype.getBrightness = function(callback) {
  var self = this;
  return Promise.resolve()
    .then(function() {
      return self.getCurrentState(callback, "brightness");
    })
    // .then(function() {
    // if (self.accessory.reachable === false) {
    //   // this is here because we set cached accessory reachable=false until we update the brightness
    //   self.accessory.updateReachability(true);
    // }
    //   return;
    // })
    .catch(function(err) {
      self.log.error(self.Name + ': Error Updating Brightness', err);
    });
};

LuxorAccessory.prototype.setBrightness = function(brightness, callback) {
  var self = this;
  //
  // return Promise.resolve()
  //   .then(function() {
  //     // self.log.debug("Attempting to Set Brightness for the '%s' to %s", self.accessory.displayName, brightness);
  if (self.accessory.context.brightness === brightness) {
    self.log('Not changing brightness to %s because it is already %s', brightness, self.accessory.context.brightness);
    callback();

  } else {
    return self.groupListEdit()
      .then(self.illuminateGroup(callback, brightness, "brightness"));
  }
  // })
  // .catch(function(err) {
  //   self.log.error(self.Name + ': Error attempting to set brightness.', err);
  // });
};

LuxorAccessory.prototype.pollingStatus = function() {
  var self = this;
  self.getBrightness(function() {
    // self.log.debug('Polled %s for change in brightness.', self.accessory.displayName);
  });
  self.getHueSaturation(function() {});

  setTimeout(self.pollingStatus.bind(this), 30 * 1000);
};

LuxorAccessory.prototype.setHue = function(value, callback) {
  var self = this;
  if (value !== self.accessory.context.due) {
    desiredHue = value;
    self.groupListEdit()
      .then(function() {
        self.log("%s calling colorListSet (from setHue) with value hue:%s", self.Name, value);
      })
      .then(function() {
        return self.colorListSet();
      })
      .then(function() {
        callback();
        return;
      });
  }
  else {
    callback();
  }
};

LuxorAccessory.prototype.getHueSaturation = function(callback) {
  var self = this;
  return controller.ColorListGet(self.accessory.context.color)
    .then(function(colors) {
      self.accessory.context.hue = colors.Hue;
      self.accessory.context.saturation = colors.Sat;

      self.accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Hue).updateValue(colors.Hue);
      self.accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Saturation).updateValue(colors.Sat);
    })
    .then(function() {
      self.log("%s: Retrieved colors for palette C%s.  Hue: %s Saturation: %s", self.Name, self.accessory.context.color, self.accessory.context.hue, self.accessory.context.saturation);
      callback();
    });

};

LuxorAccessory.prototype.setSaturation = function(value, callback) {
  var self = this;
  if (value !== self.accessory.context.saturation) {
    desiredSaturation = value;
    self.groupListEdit()
      .then(function() {
        self.log("%s calling colorListSet (from setSaturation) with value:%s", self.Name, value);
      })
      .then(function() {
        return self.colorListSet();
      })
      .then(function() {
        callback();
        return;
      });
  }
  else {
    callback();
  }

};



LuxorAccessory.prototype.colorListSet = function() {
  var self = this;
  if (desiredHue === -1 || desiredSaturation === -1) {
    desiredHueSatTimer = setTimeout(function() {
      desiredHue = -1;
      desiredSaturation = -1;
    }, 1000);
    return;
  } else {
    clearTimeout(desiredHueSatTimer);
    return controller.ColorListSet(self.accessory.context.color, desiredHue, desiredSaturation)
      .then(function() {
        self.accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Hue).setValue(desiredHue);
        self.accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Saturation).setValue(desiredSaturation);
        desiredHue = -1;
        desiredSaturation = -1;
      })
      .then(function() {
        controller.GroupListEdit(self.accessory.displayName, self.accessory.context.groupNumber, self.accessory.context.color);
        return;
      })
      .catch(function(err) {
        self.log('Error trying to set the color:', err);
      });
  }
};

LuxorAccessory.prototype.groupListEdit = function() {
  var self = this;
  return controller.GroupListGet()
    .then(function(info) {
      // if the color paletto CXXX was change outside homebridge, but the user selects to set the color/brightness then make sure we assign the right color.

      var desiredColor = 250 - info.GroupList[self.accessory.context.groupNumber - 1].GroupNumber + 1;
      var currentColor = info.GroupList[self.accessory.context.groupNumber - 1].Color;
      if (currentColor !== desiredColor) {
        self.log('%s color assignment was changed outside of HomeKit.  Changing to %s', self.Name, desiredColor);
        self.accessory.context.color = desiredColor;
        return controller.GroupListEdit(self.accessory.displayName, self.accessory.context.groupNumber, self.accessory.context.color);
      } else {
        // no change in color group
        return;
      }
    });
};

LuxorAccessory.prototype.illuminateGroup = function(callback, desiredIntensity, whichcall) {
  var self = this;
  callback();
  return controller.IlluminateGroup(self.accessory.context.groupNumber, desiredIntensity)
    .then(function(result) {
      if (result == "Ok") {
        self.accessory.context.brightness = desiredIntensity;
        self.accessory.context.binaryState = (self.accessory.context.brightness) > 0 ? 1 : 0;

        self.accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).updateValue(desiredIntensity > 0 ? 1 : 0);
        self.accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).updateValue(desiredIntensity);



        return result;
      } else {
        throw new Error(this.Name + ': Something went wrong!  Request to set %s brightness to %s: %s ', self.accessory.displayName, desiredIntensity, result);
      }
    })
    .then(function(result) {
      if (whichcall === "brightness") {
        return self.log(self.Name + ': Successfully set %s brightness to %s. %s ', self.accessory.displayName, (desiredIntensity === 0 ? "0 (Off)" : desiredIntensity), result === "Ok" ? '' : result);
      } else {
        return self.log(self.Name + ': Successfully set %s power to %s. %s ', self.accessory.displayName, (desiredIntensity === 0 ? "0 (Off)" : "On"), result === "Ok" ? '' : result);
      }
    })
    .catch(function(err) {
      throw new Error(self.accessory.displayName + " Crash! Error: " + err);
    });
};

LuxorAccessory.prototype.getCurrentState = function(callback, whichcall) {
  var self = this;

  return controller.GroupListGet()
    .then(function(info) {
      if (self.accessory.context.brightness !== info.GroupList[self.accessory.context.groupNumber - 1].Intensity) {
        self.accessory.context.brightness = info.GroupList[self.accessory.context.groupNumber - 1].Intensity; // JS arrays start at 0 while luxor numbering starts at 1
        self.accessory.context.binaryState = self.accessory.context.brightness > 0 ? 1 : 0;
        self.log(self.Name + ': Current %s of light group %s is %s', whichcall, self.accessory.displayName, (whichcall == "brightness" ? self.accessory.context.brightness : (self.accessory.context.binaryState == 1 ? "On" : "Off")));
      }

      if (whichcall == "brightness") {
        callback(null, self.accessory.context.brightness);
        self.log.debug(self.Name + ': Retrieved %s of light group %s %s: %s', whichcall, self.accessory.context.groupNumber, self.accessory.displayName, self.accessory.context.brightness);
      } else if (whichcall == "power") {
        callback(null, self.accessory.context.binaryState);
        self.log.debug(self.Name + ': Retrieved %s of light group %s %s: %s', whichcall, self.accessory.context.groupNumber, self.accessory.displayName, self.accessory.context.binaryState);
      } else {
        throw new Error(self.accessory.displayName + " Invalid Characteristic: ", whichcall);
      }
      return self.accessory.context.binaryState;
    })
    .catch(function(err) {
      callback(err);
      self.log.error(self.accessory.displayName + ": Not able to connect to the controller.  Error: " + err);
    });
};

module.exports = LuxorAccessory;
