# homebridge-luxor 2.0

This is a PLATFORM module for the [HomeBridge Platform](https://github.com/nfarina/homebridge) to control [FX Luminaire](http://www.FXL.com).  

This plug-in enables power and brightness controls for [FX Luminaire Luxor ZD](http://www.fxl.com/product/power-and-control/luxor-zd) and, additionally color, on the [FX Luminaire Luxor ZDC](http://www.fxl.com/product/power-and-control/luxor-zdc).  

# Installation

1. Install homebridge using: `npm install -g homebridge` [Full directions at HomeBridge page](https://github.com/nfarina/homebridge)
1. Install this plugin using: `npm install -g homebridge-luxor`
1. Update your configuration file. See sample-config.json in this repository for a sample.

# Specific ZDC controller with ZDC lights notes
1. This app will designate a specific Luxor color palette for each group.  The formula is (250-[group number]+1).  Group 1 will user C250, Group 2 will use C249, etc.  Homekit will then assign any colors to this new group.  This allows you to keep your existing color palettes in case you want to change the lights from the Luxor app.
1. The first time you load this module it will copy the current color palette values (hue and saturation) to the aforementioned new groups.
1. This module will poll the Luxor controller every 30 seconds for color (see note below in known issues on brightness/on/off).  If the color is changed in the Luxor app or controller, it will NOT be indicated here.  However, we will accurately display brightness/on/off.  
1. If you change any of brightness/color/on/off through HomeKit, all values will be updated in this module.

# Known Issues
1. This module will poll the Luxor controller every 30 seconds for updates to brightness/on/off.  This may appear to have a small delay when reporting a status that is changed outside of HomeKit.


# Future enhancements (in no particular order)
1. Any requests?


# Credit

1.  I knew that the FX controller had a minimal web interface, and discovered a couple of the API calls, but then found a full(?) list and implementation of the code in a Go library written by [Scott Lamb](https://github.com/scottlamb/luxor).
2.  I used the original WeMo code from [rudders](https://github.com/rudders/homebridge-wemo) as a template and hacked away at it until I got to this point.
3.  Of course, to [nfarina](https://github.com/nfarina/homebridge) for the HomeBridge and, in turn, [KhaosT](http://twitter.com/khaost) for the original [HAP-NodeJS](https://github.com/KhaosT/HAP-NodeJS) project.
4.  [David Parry](https://github.com/devbobo) for helping convert v1.0 to a platform module.
5.  The Luxor team at Hunter for providing support and test materials.
