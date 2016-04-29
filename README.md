# homebridge-luxor

This is a PLATFORM module for the [HomeBridge Platform](https://github.com/nfarina/homebridge) to control [FX Luminaire](http://www.FXL.com).  Huge props to [David Parry](https://github.com/devbobo) for converting this from an accessory to a platform in the blink of an eye!

This plug-in enables power and brightness controls for [FX Luminaire Luxor ZD](http://www.fxl.com/product/power-and-control/luxor-zd) light groups.  

# Installation

1. Install homebridge using: npm install -g homebridge [Full directions at HomeBridge page](https://github.com/nfarina/homebridge)
2. Install this plugin using: npm install -g homebridge-luxor
3. Update your configuration file. See sample-config.json in this repository for a sample. 


# Known Issues
1.  Plug-in is written only for the ZD controller (Zoning, Diming).  It may work with the ZDC (Zoning, Dimming, and Color) but I have not tested it (the color selection is not currently coded).  (See #1 in enhancements.)
2.  FIXED ~~When using the app, Program A changes the on/off or brightness, Program B will need to refresh twice to see the changes take effect.  This is because the getBrightness and getPowerOn functions return their values before the http post returns with its data.~~ 
3.  Refactor code.


# Future enhancements (in no particular order)
1.  Add ZDC configurations/code (if there is a demand)
2.  FIXED ~~Figure out the differences between the name, servicename, accessoryname, etc to enable proper HomeKit configuration and unique UUID~~
3.  FIXED ~~Add manufacturer and model (at the service level?) for various apps' aesthetics.~~ (Well, manufacturer is added anyway.)
4.  FIXED ~~Module should be able to dynamically retrieve groupname and groupnumber (as this is exposed via an API) but for now it is in the configuration file.~~
5.  FIXED ~~This module should really be converted to a platform.  Effect will be that one controller can be defined in the configuration file and all the lights will be automatically added.~~
6?. Luxor controllers have Themes (preset configurations for groups of lights) but not sure if these should be included as they could duplicate the Zones functionality in HomeKit.  Possibly Zones could be configured programatically but I haven't looked into that.
7.  There is no push notification (eg if I turn on the light manually at the controller, or via the native app, HomeKit won't get notified).  Should I implement a timer to periodically check the state of the lights and update HomeKit?


# Credit

1.  I knew that the FX controller had a minimal web interface, and discovered a couple of the API calls, but then found a full(?) list and implementation of the code in a Go library written by [Scott Lamb](https://github.com/scottlamb/luxor).
2.  I used the original WeMo code from [rudders](https://github.com/rudders/homebridge-wemo) as a template and hacked away at it until I got to this point.
3.  Of course, to [nfarina](https://github.com/nfarina/homebridge) for the HomeBridge and, in turn, [KhaosT](http://twitter.com/khaost) for the original [HAP-NodeJS](https://github.com/KhaosT/HAP-NodeJS) project. 
4.  [David Parry](https://github.com/devbobo) for helping convert this to a platform module.

