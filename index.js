/* jshint node: true */

"use strict";

var Accessory, Characteristic, Service, UUIDGen, Homebridge;


var rp = require('request-promise');
var ZD_Light = require('./ZD_Light');
var ZDC_Light = require('./ZDC_Light');
var ZD_Controller = require('./ZD_Controller');
var ZDC_TWO_Controller = require('./ZDC_TWO_Controller');
var Theme = require('./Theme');
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
    self.log = log;

    self.Name = config.name;

    if (config.removeAccessories) {
        self.removeAccessories = config.removeAccessories.split(',');
        self.removeAccessories.forEach(function(el) {
            self.removeAccessories.splice(self.removeAccessories.indexOf(el), 1, el.trim());
        });
    } else {
        self.removeAccessories = [];
    }
    self.log('Config.json includes %s accessories to remove.', self.removeAccessories.length);
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
                    controller = new ZD_Controller(self.ip_addr, self.log);
                } else if (info.Controller.substring(0, 5) === 'lxzdc') {
                    self.controllerList.type = 'ZDC';
                    self.log('Found Controller named %s of type %s', info.Controller, self.controllerList.type);
                    controller = new ZDC_TWO_Controller(self.ip_addr, self.log, self.controllerList.type);
                } else if (info.Controller.substring(0, 5) === 'lxtwo') {
                    self.controllerList.type = 'ZDTWO';
                    self.log('Found Controller named %s of type %s', info.Controller, self.controllerList.type);
                    controller = new ZDC_TWO_Controller(self.ip_addr, self.log, self.controllerList.type);
                } else {
                    self.log('Found unknown controller named %s of type %s, assuming a ZDTWO', info.Controller, self.controllerList.type);
                    controller = new luxorZDCController(self.ip_addr, self.log, 'ZDTWO');
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

LuxorPlatform.prototype.getControllerThemeList = function() {
    // Get the list of light LuxorThemes from the controller
    var self = this;
    var addAccessoryFactory = [];

    return controller.ThemeListGet()
        .then(function(info) {
            self.log('Found %s themes.', Object.keys(info.ThemeList).length);
            info.ThemeList.push({
                Name: 'Illuminate all lights',
                ThemeIndex: 25,
                OnOff: 0
            });
            info.ThemeList.push({
                Name: 'Extinguish all lights',
                ThemeIndex: 24,
                OnOff: 0
            });
            for (var i in info.ThemeList) {
                addAccessoryFactory.push(self.addThemeAccessory(info.ThemeList[i], 'new'));
            }
            return Promise.all(addAccessoryFactory);
        })
        .catch(function(err) {
            self.log.error('was not able to retrieve light themes from controller.', err);
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
            self.log('Removed accessory %s', self.accessories[uuid].accessory.displayName);
            self.accessories.splice(self.accessories[uuid], 1);
            return;
        })
        .catch(function(err) {
            self.log.error('Error removing accessory.', err);
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
                    // cached element does NOT exist in current light Theme
                    self.log('Removing orphaned cached accessory %s', self.accessories[el].accessory.displayName);
                    self.removeAccessory(self.accessories[el].accessory.UUID);
                }
            }
            return;
        });
};


LuxorPlatform.prototype.removeRequestedAccessories = function() {
    var self = this;
    /*  Removal of accessories based on config values    */
    var removeArray = [];
    return Promise.resolve()
        .then(function() {
            //self.log('REMOVE self.removeAccessories.length: %s', self.removeAccessories.length);

            if (self.removeAccessories.length > 0) {
                //self.log('self.removeAccessories[0].toLowerCase === all: ', self.removeAccessories[0].toLowerCase() === 'all');
                if (self.removeAccessories[0].toLowerCase() === 'all') {
                    for (var el in self.accessories) {

                        // cached element does NOT exist in current light Theme
                        //self.log('Pushing accessory to remove array based on _all_ value %s', self.accessories[el].accessory.displayName);
                        removeArray.push(self.removeAccessory(self.accessories[el].accessory.UUID));
                        self.removeAccessories.splice(self.removeAccessories.indexOf(el), 1);

                    }
                } else if (self.removeAccessories[0].toLowerCase() !== 'all') {
                    var didRemove;
                    while (self.removeAccessories.length > 0) {
                        didRemove = false;
                        //self.log(' REMOVE array length at beginning: ', self.removeAccessories.length);
                        //self.log('REMOVE comparing item: %s in ', self.removeAccessories[0], self.removeAccessories);
                        for (var existsEl in self.accessories) {
                            //self.log('REMOVE comparing %s to %s.', self.removeAccessories[0].toLowerCase(), self.accessories[existsEl].accessory.displayName.toLowerCase());
                            if (self.removeAccessories[0].toLowerCase() === self.accessories[existsEl].accessory.displayName.toLowerCase()) {
                                self.log('Removing accessory based on value %s', self.removeAccessories[0]);
                                removeArray.push(self.removeAccessory(self.accessories[existsEl].accessory.UUID));
                                self.log('REMOVE Array is: ', self.removeAccessories);
                                self.removeAccessories.splice(0, 1);
                                self.log('REMOVE Array after splice is: ', self.removeAccessories);
                                didRemove = true;
                                break;
                            }


                        }
                        if (didRemove === false) {
                            self.log('Tried to remove [%s] accessory, but it was not found.', self.removeAccessories);
                            //self.log('REMOVE Array is: ', self.removeAccessories);
                            self.removeAccessories.splice(0, 1);
                            //self.log('REMOVE Array after splice is: ', self.removeAccessories);

                        }


                        //self.log(' REMOVE array length at end: ', self.removeAccessories.length);

                    }
                }
                if (removeArray.length > 0) {
                    Promise.all(removeArray)
                        .then(function() {
                            return console.log('Remove accessories in array');

                        })
                        .then(function() {
                            self.log('*** Accessories have been removed.  Please use the "" (empty string) in config.json removeAccessories:"" and restart Homebridge. ***');
                            process.exit(0);
                        });
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

                if (self.controllerList.type === "ZD" || accessory.context.lightType === "ZD") {
                    //self.log('Adding %s as ZD module with ZD controller', lightGroup.Name);
                    newAccessory = new ZD_Light(accessory, self.log, Homebridge, controller);
                } else { //if (self.controllerList.type === "ZDC" || self.controllerList.type === "ZDTWO") {
                    // color fixture
                    //self.log('Adding %s as ZDC module with ZDC controller', lightGroup.Name);
                    newAccessory = new ZDC_Light(accessory, self.log, Homebridge, controller);
                }
                self.accessories[uuid] = newAccessory;
                self.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [newAccessory.accessory]);
            } else {
                self.accessories[uuid].accessory.context.lastDateAdded = self.lastDateAdded;
                //self.log.debug('Updated timestamp token on valid accessory %s. ', lightGroup.Name);
            }
            return uuid;
        })
};

LuxorPlatform.prototype.addThemeAccessory = function(themeGroup, status) {
    var self = this;

    return Promise.resolve()
        .then(function() {
            var uuid = UUIDGen.generate('luxor.theme' + themeGroup.Name);
            var newAccessory;

            if (self.accessories[uuid] === undefined) {
                //self.log('Adding new Luxor light group: ', themeGroup.Name);
                var accessory = new Accessory(themeGroup.Name, uuid);

                //update context
                accessory.context.lastDateAdded = self.lastDateAdded;
                accessory.context.ip_addr = self.ip_addr;
                accessory.context.themeIndex = themeGroup.ThemeIndex;
                accessory.context.binaryState = themeGroup.OnOff;
                accessory.context.lightType = "theme";
                accessory.context.status = 'new';

                newAccessory = new Theme(accessory, self.log, Homebridge, controller);

                self.accessories[uuid] = newAccessory;
                self.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [newAccessory.accessory]);
            } else {
                self.accessories[uuid].accessory.context.lastDateAdded = self.lastDateAdded;
                //self.log.debug('Updated timestamp token on valid theme %s. ', themeGroup.Name);
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
        //console.log(self.Name + ": " + JSON.stringify(self.accessories[uuid].context))
        switch (self.accessories[uuid].context.lightType) {
            case "theme":
                accessory = new Theme(self.accessories[uuid], self.log, Homebridge, controller);
                break;
            case "ZD":
                accessory = new ZD_Light(self.accessories[uuid], self.log, Homebridge, controller);
                break;
            case "ZDC":
                accessory = new ZDC_Light(self.accessories[uuid], self.log, Homebridge, controller);
                break;
            default:
                error_str = 'Unknown accessory of type ' + self.accessories[uuid].context.lightType;
                self.log.error(error_str);
                self.log('  Full context: ' + JSON.stringify(self.accessories[uuid].context));
                throw new Error(error_str);
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
            return self.getControllerThemeList().bind(this);
        })
        .then(function() {
            return self.removeOphanedAccessories();
        })
        .then(function() {
            return self.removeRequestedAccessories();
        })
        .then(function() {
            return self.log('Finished initializing');
        })
        .catch(function(err) {
            self.log.error('Error in didFinishLaunching', err);
        });
};