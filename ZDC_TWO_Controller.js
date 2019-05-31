/* jshint node: true */

"use strict";

var Accessory, Characteristic, Service, UUIDGen, Homebridge;


var rp = require('request-promise');
var luxorZDLight = require('./ZD_Light.js');
var luxorZDCLight = require('./ZDC_Light.js');
var Promise = require('bluebird');
var groupList = {} // hold cached results
var timeoutGroupList; // timeout for GroupListGet


module.exports = ZDC_ZDTWO_Controller;

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
        case (151):
            return ('Color Value Out of Range');
        case (201):
            return ('Precondition Failed'); //StatusPreconditionFailed
        case (202):
            return ('Group Name In Use'); //StatusGroupNameInUse
        case (205):
            return ('Group Number In Use'); //StatusGroupNumberInUse
        case (241):
            return ('Item Does Not Exist'); //StatusThemeIndexOutOfRange
        case (242):
            return ('Bad Group Number'); //StatusThemeIndexOutOfRange
        case (243):
            return ('Theme Index Out Of Range'); //StatusThemeIndexOutOfRange
        case (251):
            return ('Bad Theme Index'); //StatusThemeIndexOutOfRange
        case (252):
            return ('Theme Changes Restricted'); //StatusThemeIndexOutOfRange
        default:
            return ('Unknown status');
    }
}


function ZDC_ZDTWO_Controller(ip, log, type) {
    this.ip = ip;
    this.log = log;
    log.info(`${type} Controller @ IP ${this.ip} initialized.`);
}

ZDC_ZDTWO_Controller.prototype.IlluminateAll = function() {
    // Turn on all lights
    // Same in ZDC/TWO
    var self = this;
    self.log.debug('Turning on all lights');

    var post_options = {
        url: 'http://' + self.ip + '/IlluminateAll.json',
        method: 'POST'
    };
    return rp(post_options)
        .then(function(body) {
            var result = getStatus(JSON.parse(body).Status);

            return result;
        })
        .catch(function(err) {
            self.log.error('was not able to turn on all lights.', err);
        });
};

ZDC_ZDTWO_Controller.prototype.ExtinguishAll = function() {
    // Turn off all lights
    // Same in ZDC/TWO
    var self = this;
    self.log.debug('Turning off all lights');

    var post_options = {
        url: 'http://' + self.ip + '/ExtinguishAll.json',
        method: 'POST'
    };
    return rp(post_options)
        .then(function(body) {
            var result = getStatus(JSON.parse(body).Status);

            return result;
        })
        .catch(function(err) {
            self.log.error('was not able to turn off all lights.', err);
        });
};

ZDC_ZDTWO_Controller.prototype.GroupListGet = function() {
    // Get the list of light groups from the controller
    // ZDC supporst Groups 1-250, Intensity 0-100, Color 0-260
    // ZDTWO supports Groups 1-250, Intensity 0-100, Color 0-260 & 65535
    var self = this;
    self.log.debug('Retrieving light groups from controller');
    if (timeoutGroupList) {
        self.log.debug(`Skipping groupListGet request because we retrieved results in the past 5s already. Returning cached results.`)
            // in case we send multiple requests but none have returned, set a timer
        if (!Object.keys(groupList).length) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    return resolve(groupList)
                }, 1000)
            })
        } else {
            return Promise.resolve(groupList)
        }
    } else {
        timeoutGroupList = setTimeout(() => {
            timeoutGroupList = null;
        }, 5000)
        var post_options = {
            url: 'http://' + self.ip + '/GroupListGet.json',
            method: 'POST'
        };
        return rp(post_options)
            .then(function(body) {
                var info = JSON.parse(body);
                console.log(`retrieved groups: ${JSON.parse(body,null,2)}`)
                for (var i in info.GroupList) {
                    info.GroupList[i].GroupNumber = info.GroupList[i].Grp;
                    info.GroupList[i].Intensity = info.GroupList[i].Inten;
                    info.GroupList[i].Color = info.GroupList[i].Colr;
                }
                if (info.GroupList[i].Color >= 251) {

                    self.log.warn(`A color value of ${info.GroupList[i].Color} was found for the color of light group ${info.GroupList[i].GroupNumber}.  Values of 251-260 are ColorWheels and 65535 means the controller is under DMX Group control.  Please select a color 0-250 for this group to work in Homebridge.`)
                }
                // copy object to groupList
                Object.assign(groupList, info)
                return info;
            })
            .catch(function(err) {
                self.log.error(`was not able to retrieve light groups from controller.  ${err}\n${err.message}`);
            });
    }
};

ZDC_ZDTWO_Controller.prototype.IlluminateGroup = function(groupNumber, desiredIntensity) {
    // Same in ZDC/ZDTWO
    var self = this;
    var requestData = JSON.stringify({
        'GroupNumber': groupNumber,
        'Intensity': desiredIntensity
    });

    var rpOptions = {
        url: 'http://' + self.ip + '/IlluminateGroup.json',
        method: "POST",
        body: requestData,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };
    return rp(rpOptions)
        .then(function(body) {
            var result = getStatus(JSON.parse(body).Status);

            return result;
        })
        .catch(function(err) {
            throw new Error(`${err} \n${err.message}`);
        });
};

ZDC_ZDTWO_Controller.prototype.ColorListSet = function(color, hue, saturation) {
    // Same in ZDC/ZDTWO
    var self = this;
    var requestData = JSON.stringify({
        // assign the colors in the reverse order of their groups...
        // group 1 = color 250
        // group 2 = color 249
        // etc
        'C': color,
        'Hue': hue,
        'Sat': saturation
    });

    var rpOptions = {
        url: 'http://' + self.ip + '/ColorListSet.json',
        method: "POST",
        body: requestData,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };
    return rp(rpOptions)
        .then(function(body) {
            var result = getStatus(JSON.parse(body).Status);
            if (result === "Ok") {
                return result;
            } else {
                throw new Error(result);
            }
        })
        .catch(function(err) {
            throw new Error(`${err} \n${err.message}`);
        });
};

ZDC_ZDTWO_Controller.prototype.ColorListGet = function(color) {
    // Same in ZDC/ZDTWO
    var self = this;

    var rpOptions = {
        url: 'http://' + self.ip + '/ColorListGet.json',
        method: "POST",
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json'
        }
    };
    return rp(rpOptions)
        .then(function(body) {
            var result = JSON.parse(body);
            if (getStatus(result.Status) === "Ok") {
                var found = false;
                for (var colorId in result.ColorList) {
                    if (result.ColorList[colorId].C === color) {
                        return result.ColorList[colorId];
                    }
                }
                return self.ColorListSet(color, 360, 100)
                    .then(function() {
                        return {
                            "C": color,
                            "Hue": 360,
                            "Sat": 100
                        };
                    });
            } else {
                throw new Error(result);
            }
        })
        .catch(function(err) {
            throw new Error(`${err} \n${err.message}`);
        });
};

ZDC_ZDTWO_Controller.prototype.GroupListEdit = function(name, groupNumber, color) {
    // Same in ZDC/ZDTWO
    var self = this;
    var requestData = JSON.stringify({
        'Name': name,
        'GroupNumber': groupNumber,
        'Color': color
    });

    var rpOptions = {
        url: 'http://' + self.ip + '/GroupListEdit.json',
        method: "POST",
        body: requestData,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };

    return rp(rpOptions)
        .then(function(body) {
            var result = getStatus(JSON.parse(body).Status);
            if (result === "Ok") {
                return result;
            } else {
                throw new Error(result);
            }
        })
        .catch(function(err) {
            throw new Error(`${err} \n${err.message}`);
        });
};

ZDC_ZDTWO_Controller.prototype.ThemeListGet = function() {
    // Get the list of light groups from the controller
    // ZDC supports ThemeIndex 0-25
    // TWO supports ThemeIndex 0-39

    var self = this;
    //self.log.debug('Retrieving themes from controller');

    var post_options = {
        url: 'http://' + self.ip + '/ThemeListGet.json',
        method: 'POST'
    };
    return rp(post_options)
        .then(function(body) {
            var info = JSON.parse(body);
            return info;
        })
        .catch(function(err) {
            self.log.error(`was not able to retrieve light themes from controller. ${err} \n${err.message}`);
        });
};

ZDC_ZDTWO_Controller.prototype.IlluminateTheme = function(themeIndex, onOff) {
    // Same in ZDC/ZDTWO
    var self = this;
    var requestData = JSON.stringify({
        'ThemeIndex': themeIndex,
        'OnOff': onOff
    });

    var rpOptions = {
        url: 'http://' + self.ip + '/IlluminateTheme.json',
        method: "POST",
        body: requestData,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };
    return rp(rpOptions)
        .then(function(body) {
            var result = getStatus(JSON.parse(body).Status);

            return result;
        })
        .catch(function(err) {
            throw new Error(`${err} \n${err.message}`);
        });
};