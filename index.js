/*jslint node: true */
"use strict";

var Service, Characteristic;
var request = require('request');
var rp = require('request-promise');
var logmore = false; //false for less; true for more


module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-luxor", "Luxor", LuxorAccessory);
};


function LuxorAccessory(log, config) {
    this.log = log;
    this.name = config["name"] || this.name;
    this.service = "Lights"; // how is this used??? 
    //this.groupName = config["groupName"] || this.name; // fallback to "name" if you didn't specify an exact "groupName" --> should be able to set this automatically, but how to bind it afterwards? 
    var groupName;
    this.groupNumber = config["groupNumber"] || 1; //Luxor group numbers start at 1
    this.ip_addr = config["ipAddr"]; //mandatory
    var controller; //optional, will probably remove as we can get this programatically.  Maybe set to name?
    var binaryState; // will set programmatically via groupListGet below
    var brightness; //brightness (0-100), will set programmatically via groupListGet below
    this.device = null; //will be instance of lightbulb that we control.
    this.log("Starting a Luxor light with name %s in %s'", this.groupName, this.name);

    this.search();
}

LuxorAccessory.prototype.search = function () {
    if (!this.ip_addr) {
        throw new Error(this.Name + " needs an IP Address in the config file.  Please see sample_config.json.");
    }
    this.log("Starting search for controller at: " + this.ip_addr);

    //Search for controllor and make sure we can find it
    var post_options = {
        "url": 'http://' + this.ip_addr + '/ControllerName.json',
        "method": "POST"
    };

    var that = this;
    rp.post(post_options, function (err, response, body) {
        if (!err && response.statusCode == 200) {
            var info = JSON.parse(body);
            that.controller = info["Controller"];
            that.log('Found Controller name: ' + info["Controller"]);
        } else {
            throw new Error(that.Name + " was not able to connect to connect to the controller.  Check your IP Address.");
        }

        }).then(function (body) {

            that.groupListGet(null, null, "initial");
        });
}

LuxorAccessory.prototype.getPowerOn = function (callback) {
    if (logmore) {
        this.log("In getPowerOn")
    };
    this.groupListGet(callback, this.brightness, "power");
   
}

LuxorAccessory.prototype.setPowerOn = function (powerOn, callback) {
    this.binaryState = powerOn ? 1 : 0;
    this.log("Setting %s to %s (default 50%)", this.groupName, this.binaryState == 1 ? "on" : "off" );
    this.illuminateGroup(this.binaryState * 50); //set to 0 if we want to turn off, or 50 if we want to turn on.
    callback(null);
}

LuxorAccessory.prototype.getBrightness = function (callback) {
    if (logmore) {
        this.log("In getBrightness")
    };
    this.groupListGet(callback, this.brightness, "brightness");
}

LuxorAccessory.prototype.setBrightness = function (brightness, callback) {
    if (logmore) {
        this.log("In setBrightness")
    };
    /*if (this.brightness = 0) {
        //update characteristic(on)
        accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On)
        this.getService(Service.Lightbulb).getCharacteristic(Characteristic.On)
    };*/ //To do...
    this.brightness = this.illuminateGroup(brightness);
    this.binaryState = this.brightness > 0 ? 1 : 0;
    this.log("Set Brightness for the '%s' to %s", this.groupName, this.brightness);
    callback(null);
    
}


LuxorAccessory.prototype.getServices = function () {
    var lightbulbService = new Service.Lightbulb(this.groupName);
    if (logmore) {
        this.log("Setting services for: " + this.groupName)
    };

    lightbulbService.getCharacteristic(Characteristic.On)
        .on('get', this.getPowerOn.bind(this))
        .on('set', this.setPowerOn.bind(this));

    lightbulbService.getCharacteristic(Characteristic.Brightness)
        .on('set', this.setBrightness.bind(this))
        .on('get', this.getBrightness.bind(this))

    return [lightbulbService];
}


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

LuxorAccessory.prototype.illuminateGroup = function (desiredIntensity) {
    var that = this;
    if (logmore) {
        that.log('Setting light ' + that.groupName + ' to intensity ' + desiredIntensity)
    };

    var requestData = JSON.stringify({
        'GroupNumber': that.groupNumber,
        'Intensity': desiredIntensity
    });
    var result;
    request({
            url: 'http://' + that.ip_addr + '/IlluminateGroup.json',
            method: "POST",
            body: requestData,
            headers: {
                'cache-control': 'no-cache',
                'content-type': 'text/plain',
                'Content-Length': Buffer.byteLength(requestData)
            },
        },
        function (error, response, body) {
            if (error) {
                that.log('Error setting intesity for ' + that.groupName + ': ' + error);
            }
            result = getStatus(JSON.parse(body).Status);
            if (result == "Ok") {
                that.log('Request to set %s intensity to %s: %s ', that.groupName, desiredIntensity, result);
                that.brightness = desiredIntensity;
                that.binaryState = (that.brightness) > 0 ? 1 : 0;
            } else {
                that.log('Something went wrong!  Request to set %s intensity to %s: %s ', that.groupName, desiredIntensity, result);
            }
        });

    return (result);
};

LuxorAccessory.prototype.groupListGet = function (callback, brightness, whichcall) {
    var that = this;
    if (logmore) {
        that.log('Retrieving light group' + that.groupName + 'and their current status')
    };

    var post_options = {
        url: 'http://' + that.ip_addr + '/GroupListGet.json',
        method: 'POST'

    };

    rp.post(post_options, function (err, response, body) {
        if (!err && response.statusCode == 200) {
            var info = JSON.parse(body);
            //var arrayindex = that.groupNumber-1;  // arrays start at 0 while luxor numbering starts at 1
            if (that.groupNumber == info["GroupList"][that.groupNumber - 1].GroupNumber) {
                that.groupName = info["GroupList"][that.groupNumber - 1].Name;
                that.brightness = info["GroupList"][that.groupNumber - 1].Intensity;
                that.binaryState = that.brightness > 0 ? 1 : 0;

            } else {
                that.log("Could not match group number in config.json to controller groups");

            }
        } else {
            throw new Error(that.name + " was not able to connect to connect to the controller.  Check your IP Address. Error: " + err);
        }
    })


    .then(function (body) {;
        if (logmore) {
            that.log('End of groupListGet, result = %s', that.brightness);
            that.log('Whichcall = %s', whichcall)
        };
        if (whichcall == "brightness") {
            callback(null, that.brightness);
        } else if (whichcall == "power") {
            callback(null, that.binaryState);
        } else if (whichcall == "initial") {
            that.log('Setting initial params');
        };
    });
};