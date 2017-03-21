/* jshint node: true */
"use strict";


var rp = require('request-promise');
var Promise = require('bluebird');
var Accessory, Characteristic, Service, UUIDGen;

var LuxorAccessory = function(accessory, ip_addr, group, brightness, status, log, _Accessory, _Characteristic, _Service, _UUIDGen) {
    var self = this;

    //console.log('function LuxorAccessory: \n %s \n %s \n %s \n %s \n %s \n %s', log, accessory.UUID, ip_addr, group, brightness, status);

    // Accessory must be created from PlatformAccessory Constructor
    Accessory = _Accessory;

    // Service and Characteristic are from hap-nodejs
    Characteristic = _Characteristic;
    Service = _Service;
    UUIDGen = _UUIDGen;
    self.Name = 'LuxorPlatform';
    self.accessory = accessory;
    self.log = log;

    self.ip_addr = ip_addr;
    self.groupNumber = group;

    self.log(self.Name + ': initializing %s ZD light %s', status, self.accessory.displayName);


    // set the accessory to reachable if plugin can currently process the accessory
    // otherwise set to false and update the reachability later by invoking
    // accessory.updateReachability()
    accessory.reachable = true;

    // Plugin can save context on accessory
    // To help restore accessory in configureAccessory()
    accessory.context.group = group;


    // Make sure you provided a name for service otherwise it may not visible in some HomeKit apps.
    if (status === 'new') {
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
                self.setPower(1, function() {});
                return;
            })
            .delay(2000)
            .then(function() {
                console.log('2')
                self.setPower(0, function() {});
                return
            })
            .delay(2000)
            .then(function() {
                console.log('2')
                self.setPower(1, function() {});
                return
            })
            .delay(2000)
            .then(function() {
                console.log('2')
                self.setPower(0, function() {});
                return
            })
            .then(function() {
                callback();
                return;
            })
            .catch(function(err) {
                self.log.error('Error identifying accessory', self.accessary.displayName);
            });

    });

};

LuxorAccessory.prototype.getPower = function(callback) {
    var self = this;
    self.log("Getting power state for: ", self.accessory.displayName);
    self.getCurrentState(callback, "power");
};

LuxorAccessory.prototype.setPower = function(powerOn, callback) {
    var self = this;
    if (self.binaryState === powerOn) {
        self.log.debug('Not changing power to %s because it is already %s', powerOn, self.binaryState);
        callback();
    } else {
        self.binaryState = powerOn ? 1 : 0;
        self.log.debug("Attempting to set Power for the %s to %s", self.accessory.displayName, self.binaryState == 1 ? "on " : "off");
        if (powerOn === 1) {
            self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.Brightness, 100);
        } else {
            self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.Brightness, 0);
        }
        self.illuminateGroup(callback, self.binaryState * 100); //set to 0 if we want to turn off, or 50 if we want to turn on.
    }
};

LuxorAccessory.prototype.getBrightness = function(callback) {
    var self = this;
    self.getCurrentState(callback, "brightness");
};

LuxorAccessory.prototype.setBrightness = function(brightness, callback) {
    var self = this;
    self.log("Attempting to Set Brightness for the '%s' to %s", self.accessory.displayName, brightness);
    if (brightness === 0) {
        self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.On, 0);
    } else {
        self.accessory.getService(Service.Lightbulb).setCharacteristic(Characteristic.On, 1);
    }
    self.illuminateGroup(callback, brightness);
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
    self.log('Setting light %s (%s) to intensity ', self.accessory.displayName, self.groupNumber, (desiredIntensity === 0 ? "0 (Off)" : desiredIntensity));

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
    rp(rpOptions)
        .then(function(body) {
            var result = getStatus(JSON.parse(body).Status);
            if (result == "Ok") {
                self.log('Request to set %s intensity to %s: %s ', self.accessory.displayName, (desiredIntensity === 0 ? "0 (Off)" : desiredIntensity), result);
                self.brightness = desiredIntensity;
                self.binaryState = (self.brightness) > 0 ? 1 : 0;
                return;
            } else {
                throw new Error('Something went wrong!  Request to set %s intensity to %s: %s ', self.accessory.displayName, desiredIntensity, result);
            }
        })
        .then(function() {
            if (callback !== undefined) callback();
            return;
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
            //var arrayindex = self.groupNumber-1;  // arrays start at 0 while luxor numbering starts at 1
            /*if (self.groupNumber == info.GroupList[self.groupNumber - 1].GroupNumber) {
                self.accessory.displayName = info.GroupList[self.groupNumber - 1].Name;
                self.brightness = info.GroupList[self.groupNumber - 1].Intensity;
                self.binaryState = self.brightness > 0 ? 1 : 0;

            } else {
                self.log("Could not match group number in config.json to controller groups");

            }*/


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
