
// var desiredHue = -1,
//     desiredSaturation = -1; // HomeKit calls Hue/Saturation independently but we need both of them
// var desiredHueSatTimer; // timer to clear desired values if we don't get both
import { ZD_Light } from './ZD_Light';

import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, HapStatusError, HAPStatus } from 'homebridge';
import { IContext, LuxorPlatform } from '../LuxorPlatform';
import { IStatus } from '../controller/BaseController';

export class ZDC_Light extends ZD_Light {
    private desiredHue: number;
    private desiredSaturation: number
    private hueCallback: CharacteristicSetCallback;
    private satCallback: CharacteristicSetCallback;
    constructor(platform: LuxorPlatform, accessory: PlatformAccessory) {
        super(platform, accessory);
    }

    setServices() {
        super.setServices();

        this.service.getCharacteristic(this.platform.Characteristic.Saturation)
            .on('get', this.getSaturation.bind(this))
            .on('set', this.setSaturation.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.Hue)
            .on('get', this.getHue.bind(this))
            .on('set', this.setHue.bind(this));

        this.controller.registerCallback(this.accessory.UUID, this.context.type, this.context.groupNumber, this.platform.Characteristic.Hue, this.callbackHue.bind(this));
        this.controller.registerCallback(this.accessory.UUID, this.context.type, this.context.groupNumber, this.platform.Characteristic.Saturation, this.callbackSat.bind(this));
    }

    getHue(callback: CharacteristicGetCallback): void {
        this.controller.GetColorAsync(this.context.color).then(colors => {
            this.context.hue = colors.Hue;
            // shouldn't need this
            // this.service.updateCharacteristic(this.platform.Characteristic.Hue, colors.Hue);
            // this.service.updateCharacteristic(this.platform.Characteristic.Saturation, colors.Sat);
            callback(null, this.context.hue);
        }).catch((err) => {
            this.log.error(`${this.accessory.displayName} getHue error: ${err}`)
            callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE, false); 
        });
    };

    setHue(desiredHue: number, callback: CharacteristicSetCallback): void {
        this.desiredHue = desiredHue;
        this.hueCallback = callback;
        if (typeof this.satCallback !== 'undefined') setTimeout(() => { this.colorListSetCallbacks() }, 100);
    };
    
    getSaturation(callback: CharacteristicGetCallback): void {
        this.controller.GetColorAsync(this.context.color).then(colors => {
            this.context.saturation = colors.Sat;
            // shouldn't need this
            // this.service.updateCharacteristic(this.platform.Characteristic.Hue, colors.Hue);
            // this.service.updateCharacteristic(this.platform.Characteristic.Saturation, colors.Sat);
            callback(null, this.context.saturation);
        }).catch((err) => {
            this.log.error(`${this.accessory.displayName} getSaturation error: ${err}`)
            callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE, false);   
        });
    };

    setSaturation(desiredSaturation: number, callback: CharacteristicSetCallback): void {
        this.desiredSaturation = desiredSaturation;
        this.satCallback = callback;
        if (typeof this.hueCallback !== 'undefined') setTimeout(() => { this.colorListSetCallbacks() }, 200);
    };

    async colorListSet(): Promise<IStatus> {
        try {
            let status = await this.controller.ColorListSetAsync(this.context.color, this.desiredHue, this.desiredSaturation);
            if (status.Status > 0) {
                this.context.hue = this.desiredHue;
                this.context.saturation = this.desiredSaturation;
                this.desiredHue = undefined;
                this.desiredSaturation = undefined;
            }
            return status;
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} colorListSet error: ${err}`)
        };
    }

    colorListSetCallbacks(): void {
        this.colorListSet().then(() => {
            if (typeof this.satCallback === 'function') this.satCallback(null);
            this.satCallback = undefined;
            if (typeof this.hueCallback === 'function') this.hueCallback(null);
            this.hueCallback = undefined;
        }).catch((err) => {
            this.log.error(`${this.accessory.displayName} colorListSetCallbacks error: ${err}`)
            if (typeof this.satCallback === 'function') this.satCallback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
            this.satCallback = undefined;
            if (typeof this.hueCallback === 'function') this.hueCallback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
            this.hueCallback = undefined; 
        });
    }

    async groupListEditAsync(currentColor: number): Promise<void> {
        try {
            if (this.context.color === 0) return;
            // if the color paletto CXXX was change outside homebridge, but the user selects to set the color/brightness then make sure we assign the right color.
            var desiredColor = 250 - this.context.groupNumber + 1;
            if (currentColor !== desiredColor) {
                this.log.debug('%s color assignment was changed outside of HomeKit.  Changing to %s', this.accessory.displayName, desiredColor);
                this.context.color = desiredColor;
                await this.controller.GroupListEditAsync(this.accessory.displayName, this.context.groupNumber, this.context.color);
            }
            return Promise.resolve();
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} groupListEdit error: ${err}`); return Promise.reject();
        };
    };

    // this method used for event handling
    async getCurrentStateAsync(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                let group = await this.controller.GetGroupAsync(this.context.groupNumber);
                this.context.brightness = group.Intensity;
                this.context.isOn = this.context.brightness > 0;
                if (this.context.independentColors) await this.groupListEditAsync(group.Color);
                else { this.context.color = group.Color; }
                let colors = await this.controller.GetColorAsync(this.context.color)
                if (colors.Hue !== this.context.hue || colors.Sat !== this.context.saturation) {
                    this.desiredHue = colors.Hue;
                    this.desiredSaturation = colors.Sat;
                    await this.colorListSet();
                }
                else {
                    this.context.hue = colors.Hue;
                    this.context.saturation = colors.Sat;
                }
                resolve();
            }
            catch (err) {
                this.log.error(`${this.accessory.displayName} getCurrentStateAsync error: ${err}`)
                reject(err);
            }
        })
    }

    setCharacteristics(): void {
        this.service.updateCharacteristic(this.platform.Characteristic.On, typeof this.context.isOn !== 'undefined' ? this.context.isOn : false);
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, typeof this.context.brightness !== 'undefined' ? this.context.brightness : 0);
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, typeof this.context.hue !== 'undefined' ? this.context.hue : 0);
        this.service.updateCharacteristic(this.platform.Characteristic.Saturation, typeof this.context.saturation !== 'undefined' ? this.context.saturation : 0);
    }

    // this method used for callbacks
    callbackHue(hue: number): void {
        if (hue !== this.context.hue && this.context.color !== 0) {
            this.context.hue = hue;
            // this.log.debug(`${this.accessory.displayName} updated hue to ${hue}.`);
            this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);
        }
    };
    
    callbackSat(saturation: number): void {
        if (saturation !== this.context.saturation && this.context.color !== 0) {
            this.context.saturation = saturation;
            // this.log.debug(`${this.accessory.displayName} updated saturation to ${saturation}.`);
            this.service.updateCharacteristic(this.platform.Characteristic.Saturation, saturation);
        }
    };
}