/* jshint node: true */

"use strict";

var Accessory, Characteristic, Service, UUIDGen, Homebridge;


var rp = require('request-promise');
var luxorZDLight = require('./luxorZDLight.js');
var luxorZDCLight = require('./luxorZDCLight.js');
var luxorZDController = require('./luxorZDController.js');
var luxorZDCController = require('./luxorZDCController.js');
var controller; // will be assigned to ZD or ZDC controller
var Promise = require('bluebird');


module.exports = function(homebridge) {
  // console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Characteristic = homebridge.hap.Characteristic;
  Service = homebridge.hap.Service;
  UUIDGen = homebridge.hap.uuid;
  Homebridge = homebridge;
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-luxor", "Luxor", LuxorPlatform, true);
};

function LuxorPlatform(log, config, api) {

  var self = this;
  self.config = config || {};

  self.Name = config.name;
  self.log = log;

  self.lastDateAdded = Date.now();

  self.accessories = [];

  self.ip_addr = config.ipAddr;
  self.controllerList = {}; // object to hold controller variables


  if (api) {
    // Save the API object as plugin needs to register new accessory via this object.
    self.api = api;

    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories
    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  }
}


LuxorPlatform.prototype.getController = function() {
  // get the name of the controller
  var self = this;

  if (Object.keys(self.controllerList).length !== 0) {
    self.log.debug(this.Name + ': Already have cached controller:', self.controllerList);
    return self.controllerList;
  } else {
    self.log(this.Name + ": Starting search for controller at: " + self.ip_addr);

    //Search for controllor and make sure we can find it
    var post_options = {
      "url": 'http://' + this.ip_addr + '/ControllerName.json',
      "method": "POST"
    };


    return rp.post(post_options)
      .then(function(body) {
        var info = JSON.parse(body);
        self.controllerList = info;
        if (info.Controller.substring(0, 5) === 'luxor') {
          self.controllerList.type = 'ZD';
          self.log('Found Controller named %s of type %s', info.Controller, self.controllerList.type);
          controller = new luxorZDController(self.ip_addr, self.log);
        } else if (info.Controller.substring(0, 5) === 'lxzdc') {
          // "lxzdc"
          self.controllerList.type = 'ZDC';
          self.log('Found Controller named %s of type %s', info.Controller, self.controllerList.type);
          controller = new luxorZDCController(self.ip_addr, self.log);

        }

        return self.controllerList;
      })
      .catch(function(err) {
        self.log.error(self.Name + ' was not able to connect to connect to the controller. ', err);
      });
  }
};

LuxorPlatform.prototype.getControllerGroupList = function() {
  // Get the list of light groups from the controller
  var self = this;
  var addAccessoryFactory = [];

  return controller.GroupListGet()
    .then(function(info) {
      self.log('Found %s light groups.', Object.keys(info.GroupList).length);
      for (var i in info.GroupList) {
        addAccessoryFactory.push(self.addAccessory(info.GroupList[i], 'new'));
      }
      return Promise.all(addAccessoryFactory);
    })
    .catch(function(err) {
      self.log.error('was not able to retrieve light groups from controller.', err);
    });
};


LuxorPlatform.prototype.removeAccessory = function(uuid) {
  var self = this;

  return Promise.resolve()
    .then(function() {
      // remove accessory from Homebridge
      return self.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [self.accessories[uuid].accessory]);
    })
    .then(function() {
      self.log('Removed orphaned accessory %s', self.accessories[uuid].accessory.displayName);
      self.accessories.splice(self.accessories[uuid], 1);
      return;
    })
    .catch(function(err) {
      self.log.error('Error removing accessory.', err)
    });
};



// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
LuxorPlatform.prototype.configureAccessory = function(accessory) {
  var self = this;
  self.log.debug('Retrieved cached accessory %s ending with UUID %s', accessory.displayName, accessory.UUID.substring(accessory.UUID.length - 6, accessory.UUID.length));
  if (this.accessories[accessory.UUID] === undefined) {
    this.accessories[accessory.UUID] = accessory;
    this.accessories[accessory.UUID].context.status = 'cached';

  } else {
    // If the app crashes, it could add the same object to the cache again.
    // This is just an extra safe guard to ensure we don't have
    // cached items of the same name.
    self.log('REMOVING duplicate cached accessory.uuid', accessory.UUID);
    this.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
  }
  return;

};

LuxorPlatform.prototype.removeOphanedAccessories = function() {
  var self = this;
  /*  IF ACCESSORIES DO NOT HAVE THE LATEST DATE/TIME STAMP, THEY NEED TO BE REMOVED    */
  return Promise.resolve()
    .then(function() {
      for (var el in self.accessories) {
        if (self.accessories[el].accessory.context.lastDateAdded !== self.lastDateAdded) {
          // cached element does NOT exist in current light group
          self.log('Removing orphaned cached accessory %s', self.accessories[el].accessory.displayName);
          self.removeAccessory(self.accessories[el].accessory.UUID);
        }
      }
      return;
    });
};

LuxorPlatform.prototype.addAccessory = function(lightGroup, status) {
  var self = this;

  return Promise.resolve()
    .then(function() {
      var lightType;
      if (lightGroup.Color === 0) {
        lightType = "ZD";
      } else {
        lightType = "ZDC";
      }
      var uuid = UUIDGen.generate('luxor.' + lightType + lightGroup.Name);
      var newAccessory;

      if (self.accessories[uuid] === undefined) {
        //self.log('Adding new Luxor light group: ', lightGroup.Name);
        var accessory = new Accessory(lightGroup.Name, uuid);

        //update context
        accessory.context.lastDateAdded = self.lastDateAdded;
        accessory.context.ip_addr = self.ip_addr;
        accessory.context.color = lightGroup.Color;
        accessory.context.groupNumber = lightGroup.GroupNumber;
        accessory.context.brightness = lightGroup.Intensity;
        accessory.context.lightType = lightType;

        accessory.context.status = 'new';

        if (self.controllerList.type === "ZD") {
          //self.log('Adding %s as ZD module with ZD controller', lightGroup.Name);
          newAccessory = new luxorZDLight(accessory, self.log, Homebridge, controller);
        } else if (self.controllerList.type === "ZDC") {
          if (accessory.context.lightType === "ZD") {
            // Monochrome fixture
            //self.log('Adding %s as ZD module with ZDC controller', lightGroup.Name);
            newAccessory = new luxorZDLight(accessory, self.log, Homebridge, controller);
          } else {
            // color fixture
            //self.log('Adding %s as ZDC module with ZDC controller', lightGroup.Name);
            newAccessory = new luxorZDCLight(accessory, self.log, Homebridge, controller);
          }

        }
        self.accessories[uuid] = newAccessory;
        self.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [newAccessory.accessory]);
      } else {
        self.accessories[uuid].accessory.context.lastDateAdded = self.lastDateAdded;
        self.log.debug('Updated timestamp token on valid accessory %s. ', lightGroup.Name);
      }
      return uuid;
    })
    .then(function(uuid) {
      return;
    });

};

LuxorPlatform.prototype.processCachedAccessories = function() {
  var self = this;
  var accessory;
  for (var uuid in self.accessories) {
    if (self.controllerList.type === "ZD") {
      accessory = new luxorZDLight(self.accessories[uuid], self.log, Homebridge, controller);
    } else if (self.controllerList.type === "ZDC") {
      if (self.accessories[uuid].context.lightType === 'ZD') {
        accessory = new luxorZDLight(self.accessories[uuid], self.log, Homebridge, controller);
      } else if (self.accessories[uuid].context.lightType === 'ZDC') {
        accessory = new luxorZDCLight(self.accessories[uuid], self.log, Homebridge, controller);
      } else {
        console.log('WHOA!!! What is this? %s  \n\t %s', uuid, self.accessories[uuid])
      }
    }
    self.accessories[uuid] = accessory;

  }
  return;
};

LuxorPlatform.prototype.didFinishLaunching = function() {
  var self = this;

  if (!self.ip_addr) {
    self.log.error(this.Name + " needs an IP Address in the config file.  Please see sample_config.json.");
  }
  return Promise.resolve()
    .then(function() {
      return self.getController().bind(this)
        .then(function() {});
    })
    .then(function() {
      return self.processCachedAccessories();
    })
    .then(function() {

      return self.getControllerGroupList().bind(this);
    })
    .then(function() {
      return self.removeOphanedAccessories();
    })
    // .then(function() {
    //     // run this now to get brightness of any cached accessories, and start the polling interval
    //     return self.pollingBrightness();
    // })
    .then(function() {
      return self.log('Finished initializing');
    })
    .catch(function(err) {
      self.log.error('Error in didFinishLaunching', err);
    });
};
