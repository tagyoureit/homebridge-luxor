/* jshint node: true */

"use strict";

var Accessory, Characteristic, Service, UUIDGen, Homebridge;


var rp = require('request-promise');
var luxorZDLight = require('./luxorZDLight.js');
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


    self.accessories = [];

    self.ip_addr = config.ipAddr;
    self.controller = {}; // object to hold controller variables
    self._tmpControllerLightGroups = []; // temporary storage for light groups retrieve from light controller

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

    if (Object.keys(self.controller).length !== 0) {
        self.log.debug(this.Name + ': Already have cached controller:', self.controller);
        return self.controller;
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
                self.controller = info.Controller;
                if (info.Controller.substring(0, 4) === 'luxor') {
                    self.controllerType = 'ZD';
                } else {
                    // "lxzdc"
                    self.controllerType = 'ZDC';
                }
                self.log('Found Controller named ' + info.Controller);
                return self.controller;
            })
            .catch(function(err) {
                self.log.error(self.Name + ' was not able to connect to connect to the controller. ', err);
            });
    }
};

LuxorPlatform.prototype.getControllerGroupList = function() {
    // Get the list of light groups from the controller
    var self = this;
    self.log.debug('Retrieving light groups from controller');

    var post_options = {
        url: 'http://' + self.ip_addr + '/GroupListGet.json',
        method: 'POST'
    };
    return rp(post_options)
        .then(function(body) {
            var info = JSON.parse(body);
            for (var i in info.GroupList) {
                self._tmpControllerLightGroups[i] = info.GroupList[i];
            }
            self.log('Found %s light groups.', Object.keys(info.GroupList).length);
            return self._tmpControllerLightGroups;
        })
        .catch(function(err) {
            self.log.error('was not able to retrieve light groups from controller.', err);
        });
};


LuxorPlatform.prototype.removeAccessory = function(accessory) {
    var self = this;
    self.log('Removed accessory %s', accessory.displayName);

    // remove accessory from Homebridge
    self.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);

    // loop to remove accessory from self.accessories cache
    for (var i = 0; i < self.accessories.length; i++) {
        if (accessory.displayName === self.accessories[i].accessory.displayName) {
            self.log.debug('Removing %s from local cache.', accessory.displayName);
            self.accessories.splice(i, 1);
            break;
        }
    }
    return;
};

LuxorPlatform.prototype.pollingBrightness = function() {
    var self = this;
    if (Object.keys(self.accessories).length > 0) {
        self.accessories.map(function(el) {
            el.getBrightness(function() {
                self.log.debug('Polled %s for change in brightness.', el.accessory.displayName);
            });
        });
    }
    setTimeout(self.pollingBrightness.bind(this), 30 * 1000);
};


// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
LuxorPlatform.prototype.configureAccessory = function(accessory) {

    var self = this;
    self.log.debug('processing cached accessory %s', accessory.displayName);

    /*  FIRST: ADD ANY CACHED ACCESSORIES    */
    // In the SECOND step we will remove the accessory if it is no longer valid

    // If the app crashes, it could add the same object to the cache again.
    // This is just an extra safe guard to ensure we don't have
    // cached items of the same name.
    var duplicate = false;
    // console.log('acc.leng', self.accessories.length)
    for (var i = 0; i < self.accessories.length; i++) {
        // console.log(i + ': ' + self.accessories[i].accessory.displayName)
        // console.log('match?', accessory.displayName===self.accessories[i].accessory.displayName)
        if (accessory.displayName === self.accessories[i].accessory.displayName) {
            self.log.debug('Found duplicate light %s in cache.  Something previously went wrong.', accessory.displayName);
            this.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
            duplicate = true;
            return;
        }
    }
    if (duplicate === false) {
        // accessory has not already been added to self.accessories
        accessory = new luxorZDLight(accessory, self.ip_addr, accessory.context.group, 0, 'cached', self.log, Homebridge);
        self.accessories.push(accessory);
        return;
    }

};

LuxorPlatform.prototype.addAccessory = function() {
    var self = this;
    var action = '';


    /*  SECOND: IF CACHED ACCESSORIES ARE NOT PART OF CURRENT GROUP, REMOVE THEM    */
    if (Object.keys(self.accessories).length > 0) {
        self.accessories.map(function(el) {
            var found = 0;
            self.log.debug('Checking if %s is still a valid (from cache) accessory', el.accessory.displayName);
            self._tmpControllerLightGroups.map(function(el2) {
                // console.log('still valid? ', el2.Name === el.accessory.displayName, el2.Name, el.accessory.displayName)
                if (el2.Name === el.accessory.displayName) {
                    found = 1;
                }
            });
            if (found === 0) {
                // cached element does NOT exist in current light group
                self.log('Removing cached accessory %s', el.accessory.displayName);
                //self.accessories.splice(el.accessory, 1);
                //self.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [el.accessory]);
                self.removeAccessory(el.accessory);
            }
        });
    }

    // this.accessories.map(function(el, i) {
    //     console.log('AFTER removed accessory ' + i + ': ' + el.accessory.displayName)
    // })
    /*  THIRD: IF NEW LIGHT GROUPS ARE FOUND, ADD THEM    */
    self._tmpControllerLightGroups.map(function(el) {
        self.log.debug('Checking to see if %s is a new (from controller) accessory.', el.Name);
        var found = 0;
        self.accessories.map(function(el2) {
            // loop through _tmp array for each self.accessories to see if there is a match
            // if it is not already in the accessories array we will add it
            // if is in the self.accessories cache then we already know about it and will skip it.
            if (el.Name === el2.accessory.displayName) {
                self.log.debug('' + el.Name + ' was already added because it is a cached accessory.');
                found = 1;
            }
        });

        if (found === 0) {
            self.log('Adding new Luxor light group: ', el.Name);
            // var item = self._tmpControllerLightGroups[index];
            var uuid = UUIDGen.generate(el.Name);
            var accessory = new Accessory(el.Name, uuid);
            self.accessories.push(new luxorZDLight(accessory, self.ip_addr, el.GroupNumber, el.brightness, 'new', self.log, Homebridge));
            self.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
        }
    });


    self._tmpControllerLightGroups = []; // reset the array

    return;

};


LuxorPlatform.prototype.didFinishLaunching = function() {
    var self = this;
    var promiseArray = [];

    if (!self.ip_addr) {
        self.log.error(this.Name + " needs an IP Address in the config file.  Please see sample_config.json.");
    }
    return Promise.resolve()
        .then(function() {
            return self.getController().bind(this);
        })
        .then(function() {
            return self.getControllerGroupList().bind(this);
        })
        .then(function() {
            return self.addAccessory();
        })
        .then(function() {
            // run this now to get brightness of any cached accessories, and start the polling interval
            return self.pollingBrightness();
        })
        .catch(function(err) {
            self.log.error('Error in didFinishLaunching', err);
        });
};
