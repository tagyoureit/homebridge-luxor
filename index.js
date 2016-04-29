/* jshint node: true */

"use strict";

var Accessory, Characteristic, Service, UUIDGen;

var request = require('request');
var rp = require('request-promise');
var logmore = false; //false for less; true for more

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-luxor", "Luxor", LuxorPlatform, true);
};

function LuxorPlatform(log, config, api) {
    this.config = config || {};

    this.api = api;
    this.accessories = {};
    this.log = log;
    
    this.ip_addr = config.ipAddr; 
    
    this.search();
}

LuxorPlatform.prototype.addAccessory = function(uuid, name, group, brightness) {
    this.log("Found: %s [Group %d]", name, group);

    var accessory = new Accessory(name, uuid);
    
    accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Luxor");
        
    accessory
        .addService(Service.Lightbulb)
        .addCharacteristic(Characteristic.Brightness);

    this.accessories[accessory.UUID] = new LuxorAccessory(this.log, accessory, this.ip_addr, group, brightness);
    this.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
};

LuxorPlatform.prototype.configureAccessory = function(accessory) {
    this.accessories[accessory.UUID] = accessory;
};

LuxorPlatform.prototype.groupListGet = function (callback, whichcall) {
    var self = this;
    if (logmore) {
        self.log('Retrieving light groups');
    }

    var post_options = {
        url: 'http://' + self.ip_addr + '/GroupListGet.json',
        method: 'POST'
    };

    rp.post(post_options, function (err, response, body) {
        if (!err && response.statusCode == 200) {
            var info = JSON.parse(body);
            for (var i in info.GroupList) {
                var item = info.GroupList[i];
                var uuid = UUIDGen.generate(item.Name);
                var accessory = self.accessories[uuid];
            
                if (accessory === undefined) {
                    self.addAccessory(uuid, item.Name, item.GroupNumber, item.Intensity);
                }
                else if (accessory instanceof Accessory) {
                    self.accessories[accessory.UUID] = new LuxorAccessory(self.log, accessory, self.ip_addr, item.GroupNumber, item.Intensity);
                }
            }
        } else {
            throw new Error("Was not able to connect to the controller.  Check your IP Address. Error: " + err);
        }
    });
};

LuxorPlatform.prototype.search = function () {
    if (!this.ip_addr) {
        throw new Error(this.Name + " needs an IP Address in the config file.  Please see sample_config.json.");
    }
    this.log("Starting search for controller at: " + this.ip_addr);

    //Search for controllor and make sure we can find it
    var post_options = {
        "url": 'http://' + this.ip_addr + '/ControllerName.json',
        "method": "POST"
    };

    var self = this;
    rp.post(post_options, function (err, response, body) {
        if (!err && response.statusCode == 200) {
            var info = JSON.parse(body);
            self.controller = info.Controller;
            self.log('Found Controller name: ' + info.Controller);
        } else {
            throw new Error(self.accessory.displayName + " was not able to connect to connect to the controller.  Check your IP Address.");
        }

        }).then(function (body) {

            self.groupListGet();
        });
};

function LuxorAccessory(log, accessory, ip_addr, group, brightness) {
    var self = this;

    this.accessory = accessory;
    this.log = log;
    
    this.ip_addr = ip_addr;
    this.groupNumber = group;
    this.brightness = brightness;
    this.binaryState = brightness > 0 ? 1 : 0;

    this.accessory.on('identify', function(paired, callback) {
        self.log("%s - identify", self.accessory.displayName);
        callback();
    });
    
    var service = this.accessory.getService(Service.Lightbulb);
    
    service.getCharacteristic(Characteristic.On)
        .on('get', this.getPowerOn.bind(this))
        .on('set', this.setPowerOn.bind(this));

    service.getCharacteristic(Characteristic.Brightness)
        .on('set', this.setBrightness.bind(this))
        .on('get', this.getBrightness.bind(this));
}

LuxorAccessory.prototype.getPowerOn = function (callback) {
    if (logmore) {
        this.log("In getPowerOn");
    }
    this.getCurrentState(callback, "power");
};

LuxorAccessory.prototype.setPowerOn = function (powerOn, callback) {
    this.binaryState = powerOn ? 1 : 0;
    if (logmore){
        this.log("Attepmting to set Power for the %s to %s", this.accessory.displayName, this.binaryState == 1 ? "on (default 50%)" : "off" );        
    }
    this.illuminateGroup(callback,this.binaryState * 50);  //set to 0 if we want to turn off, or 50 if we want to turn on.
};

LuxorAccessory.prototype.getBrightness = function (callback) {
    if (logmore) {
        this.log("In getBrightness");
    }
    this.getCurrentState(callback, "brightness");
};

LuxorAccessory.prototype.setBrightness = function (brightness, callback) {
    if (logmore) {
        this.log("Attempting to Set Brightness for the '%s' to %s", this.accessory.displayName, brightness);
    }
    this.illuminateGroup(callback, brightness);
};


LuxorAccessory.prototype.getServices = function () {
    var lightbulbService = new Service.Lightbulb(this.accessory.displayName);
    if (logmore) {
        this.log("Setting services for: " + this.accessory.displayName);
    }

    lightbulbService.getCharacteristic(Characteristic.On)
        .on('get', this.getPowerOn.bind(this))
        .on('set', this.setPowerOn.bind(this));

    lightbulbService.getCharacteristic(Characteristic.Brightness)
        .on('set', this.setBrightness.bind(this))
        .on('get', this.getBrightness.bind(this));

    return [lightbulbService];
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
LuxorAccessory.prototype.illuminateGroup = function (callback, desiredIntensity) {
        var self = this;
        if (logmore) {
            self.log('Setting light %s (%s) to intensity ', self.accessory.displayName, self.groupNumber, (desiredIntensity == 0 ? "0 (Off)" : desiredIntensity));
        }

        var requestData = JSON.stringify({
            'GroupNumber': self.groupNumber,
            'Intensity': desiredIntensity
        });
        var result;
        rp({
                url: 'http://' + self.ip_addr + '/IlluminateGroup.json',
                method: "POST",
                body: requestData,
                headers: {
                    'cache-control': 'no-cache',
                    'content-type': 'text/plain',
                    'Content-Length': Buffer.byteLength(requestData)
                }
            },
            function (error, response, body) {
                if (error) {
                    self.log('Error setting intesity for ' + self.accessory.displayName + ': ' + error);
                }
                result = getStatus(JSON.parse(body).Status);
                if (result == "Ok") {
                    self.log('Request to set %s intensity to %s: %s ', self.accessory.displayName, (desiredIntensity == 0 ? "0 (Off)" : desiredIntensity), result);
                self.brightness = desiredIntensity;
                self.binaryState = (self.brightness) > 0 ? 1 : 0;
            } else {
                self.log('Something went wrong!  Request to set %s intensity to %s: %s ', self.accessory.displayName, desiredIntensity, result);
            }
        }).then(function (body) {
        callback(null);
    })
    .catch(function (err) {
        throw new Error(self.accessory.displayName + " Crash! Error: " + err);
    });


};

LuxorAccessory.prototype.getCurrentState = function (callback, whichcall) {
    var self = this;
    if (logmore) {
        self.log('Retrieving current %s of light group %s (%s)', whichcall, self.accessory.displayName, self.groupNumber);
    }

    var post_options = {
        url: 'http://' + self.ip_addr + '/GroupListGet.json',
        method: 'POST'

    };

    rp(post_options, function (err, response, body) {
        if (!err && response.statusCode == 200) {
            var info = JSON.parse(body);
            //var arrayindex = self.groupNumber-1;  // arrays start at 0 while luxor numbering starts at 1
            /*if (self.groupNumber == info.GroupList[self.groupNumber - 1].GroupNumber) {
                self.accessory.displayName = info.GroupList[self.groupNumber - 1].Name;
                self.brightness = info.GroupList[self.groupNumber - 1].Intensity;
                self.binaryState = self.brightness > 0 ? 1 : 0;

            } else {
                self.log("Could not match group number in config.json to controller groups");

            }*/
            self.brightness = info.GroupList[self.groupNumber - 1].Intensity;  // JS arrays start at 0 while luxor numbering starts at 1
            self.binaryState = self.brightness > 0 ? 1 : 0;
        } else {
            throw new Error(self.accessory.displayName + " was not able to connect to the controller.  Check your IP Address. Error: " + err);
        }
    })

    .then(function (body) {
        if (logmore) 
        {
             self.log('Successfully retrieved current %s of light group %s with result = %s', whichcall, self.accessory.displayName, (whichcall == "brightness" ? self.brightness: (self.binaryState==1?"On":"Off")));
        }
        
           
        if (whichcall == "brightness") {
            callback(null, self.brightness);
        } else if (whichcall == "power") {
            callback(null, self.binaryState);
        }
        else {throw new Error(self.accessory.displayName + " Crash! Error: " + err);};
    })
    .catch(function (err) {
    throw new Error(self.accessory.displayName + " Crash! Error: " + err);
    });
};
