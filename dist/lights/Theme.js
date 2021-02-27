"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Theme = void 0;
const ZD_Light_1 = require("./ZD_Light");
class Theme extends ZD_Light_1.ZD_Light {
    constructor(platform, accessory) {
        super(platform, accessory);
    }
    setServices() {
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, "Luxor")
            .setCharacteristic(this.platform.Characteristic.Model, this.context.type);
        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);
        this.accessory.getService(this.platform.Service.Switch)
            .getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));
        this.accessory.on('identify', async () => {
            this.log.info(`Identifying ${this.accessory.displayName}.  Scene will turn on for 5s and then off.`);
            await this.illuminateTheme();
            await this.sleep(3000);
            await this.illuminateTheme(0);
        });
        try {
            this.getCurrentStateAsync().then(() => {
                this.setCharacteristics();
            });
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} setServices error: ${err}`);
        }
        // don't register "fake" illumate/extinguish all themes.
        // don't register any themes because we don't care if the controller thinks they are on;
        // we want them to show as 'off' so they can act as a push button
        /* if (this.context.themeIndex < 100) {
            this.controller.registerCallback(this.accessory.UUID, this.context.type, this.context.themeIndex, this.platform.Characteristic.On, this.callbackBrightness.bind(this));
        } */
    }
    getOn(callback) {
        // Themes should always show as off
        callback(null, 0);
    }
    setOn(desiredOn, callback) {
        callback(null); // call callback first so we don't encounter 6s delay and downstream status' can update properly
        setTimeout(async () => { await this.illuminateTheme(), 100; });
    }
    ;
    async illuminateTheme(desiredState = 1) {
        try {
            this.log.info(`${this.accessory.displayName} turning ${desiredState === 1 ? 'on' : 'off'}`);
            if (this.context.themeIndex === 101) {
                //all off
                await this.controller.ExtinguishAllAsync();
                this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                this.context.isOn = false;
                this.context.OnOff = 0;
            }
            else if (this.context.themeIndex === 100) {
                //all on
                await this.controller.IlluminateAllAsync();
                this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                this.context.isOn = false;
                this.context.OnOff = 0;
            }
            else {
                // if theme is on (on the luxor) turn it off so we can turn it on.  It won't 
                // set the theme if it is already "on" even if other lights have changed
                await this.controller.IlluminateThemeAsync(this.context.themeIndex, 0);
                if (desiredState === 1) {
                    await this.sleep(100);
                    await this.controller.IlluminateThemeAsync(this.context.themeIndex, 1);
                }
                this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                this.context.isOn = false;
                this.context.OnOff = 0;
                if (this.context.isOn) {
                    this.context.isOn = false;
                    this.context.OnOff = 0;
                    await this.sleep(1000);
                    // don't actually turn of switch or it will turn off lights
                    // await this.controller.IlluminateThemeAsync(this.context.themeIndex, this.context.OnOff);
                    this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                }
            }
            await this.sleep(500);
            await this.controller.updateLights(true);
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} illuminateTheme: ${err}`);
        }
    }
    ;
    setCharacteristics() {
        this.service.updateCharacteristic(this.platform.Characteristic.On, typeof this.context.isOn !== 'undefined' ? this.context.isOn : false);
    }
    // this method used for event handling
    async getCurrentStateAsync() {
        try {
            //themes should always show as off even if the controller has the state of 'on'
            this.context.isOn = false;
            this.context.OnOff = 0;
            return Promise.resolve();
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} getCurrentStateAsync error: ${err}`);
            return Promise.reject(err);
        }
    }
    ;
    // this method used for callbacks
    async callbackOn(isOn) {
        try {
            if (this.context.isOn !== isOn) {
                this.log.debug(`${this.accessory.displayName} updated isOn to ${isOn ? 'on' : 'off'}.`);
                this.context.isOn = isOn;
                this.context.OnOff = isOn ? 1 : 0;
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.context.isOn);
            }
            return Promise.resolve();
        }
        catch (err) {
            this.log.error(err);
            return Promise.reject(err);
        }
    }
}
exports.Theme = Theme;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGhlbWUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbGlnaHRzL1RoZW1lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUlBLHlDQUFrRDtBQUlsRCxNQUFhLEtBQU0sU0FBUSxtQkFBUTtJQU8vQixZQUFZLFFBQXVCLEVBQUUsU0FBNEI7UUFDN0QsS0FBSyxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsV0FBVztRQUNQLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDO2FBQ2hFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxPQUFPLENBQUM7YUFDckUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUUsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsSSxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTlGLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQzthQUNsRCxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENB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LENBQUMsU0FBUyxDQUFDLFdBQVcsb0JBQW9CLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO2dCQUN4RixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7Z0JBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDekY7WUFDRCxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUM1QjtRQUNELE9BQU8sR0FBRyxFQUFFO1lBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFBQyxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7U0FBRTtJQUNwRSxDQUFDO0NBQ0o7QUEvSEQsc0JBK0hDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQgeyBTZXJ2aWNlLCBQbGF0Zm9ybUFjY2Vzc29yeSwgQ2hhcmFjdGVyaXN0aWNWYWx1ZSwgQ2hhcmFjdGVyaXN0aWNTZXRDYWxsYmFjaywgQ2hhcmFjdGVyaXN0aWNHZXRDYWxsYmFjaywgTG9nZ2VyIH0gZnJvbSAnaG9tZWJyaWRnZSc7XG5pbXBvcnQgeyBJQ29udGV4dCwgTHV4b3JQbGF0Zm9ybSB9IGZyb20gJy4uL0x1eG9yUGxhdGZvcm0nO1xuaW1wb3J0IHsgQmFzZUNvbnRyb2xsZXIgfSBmcm9tICcuLi9jb250cm9sbGVyL0Jhc2VDb250cm9sbGVyJztcbmltcG9ydCB7IElMaWdodFR5cGUsIFpEX0xpZ2h0IH0gZnJvbSAnLi9aRF9MaWdodCc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyByZWplY3RzIH0gZnJvbSAnYXNzZXJ0JztcblxuZXhwb3J0IGNsYXNzIFRoZW1lIGV4dGVuZHMgWkRfTGlnaHQge1xuICAgIHByb3RlY3RlZCBhY2Nlc3Nvcnk6IFBsYXRmb3JtQWNjZXNzb3J5O1xuICAgIHByb3RlY3RlZCBsb2c6IExvZ2dlcjtcbiAgICBwcm90ZWN0ZWQgc2VydmljZTogU2VydmljZTtcbiAgICBwcm90ZWN0ZWQgY29udHJvbGxlcjogQmFzZUNvbnRyb2xsZXI7XG4gICAgcHJvdGVjdGVkIHBsYXRmb3JtOiBMdXhvclBsYXRmb3JtO1xuICAgIHByb3RlY3RlZCBjb250ZXh0OiBJQ29udGV4dDtcbiAgICBjb25zdHJ1Y3RvcihwbGF0Zm9ybTogTHV4b3JQbGF0Zm9ybSwgYWNjZXNzb3J5OiBQbGF0Zm9ybUFjY2Vzc29yeSkge1xuICAgICAgICBzdXBlcihwbGF0Zm9ybSwgYWNjZXNzb3J5KTtcbiAgICB9XG5cbiAgICBzZXRTZXJ2aWNlcygpIHtcbiAgICAgICAgdGhpcy5hY2Nlc3NvcnkuZ2V0U2VydmljZSh0aGlzLnBsYXRmb3JtLlNlcnZpY2UuQWNjZXNzb3J5SW5mb3JtYXRpb24pXG4gICAgICAgICAgICAuc2V0Q2hhcmFjdGVyaXN0aWModGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5NYW51ZmFjdHVyZXIsIFwiTHV4b3JcIilcbiAgICAgICAgICAgIC5zZXRDaGFyYWN0ZXJpc3RpYyh0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLk1vZGVsLCB0aGlzLmNvbnRleHQudHlwZSk7XG4gICAgICAgIHRoaXMuc2VydmljZSA9IHRoaXMuYWNjZXNzb3J5LmdldFNlcnZpY2UodGhpcy5wbGF0Zm9ybS5TZXJ2aWNlLlN3aXRjaCkgfHwgdGhpcy5hY2Nlc3NvcnkuYWRkU2VydmljZSh0aGlzLnBsYXRmb3JtLlNlcnZpY2UuU3dpdGNoKTtcbiAgICAgICAgdGhpcy5zZXJ2aWNlLnNldENoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuTmFtZSwgdGhpcy5hY2Nlc3NvcnkuZGlzcGxheU5hbWUpO1xuXG4gICAgICAgIHRoaXMuYWNjZXNzb3J5LmdldFNlcnZpY2UodGhpcy5wbGF0Zm9ybS5TZXJ2aWNlLlN3aXRjaClcbiAgICAgICAgICAgIC5nZXRDaGFyYWN0ZXJpc3RpYyh0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLk9uKVxuICAgICAgICAgICAgLm9uKCdnZXQnLCB0aGlzLmdldE9uLmJpbmQodGhpcykpXG4gICAgICAgICAgICAub24oJ3NldCcsIHRoaXMuc2V0T24uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5hY2Nlc3Nvcnkub24oJ2lkZW50aWZ5JywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgSWRlbnRpZnlpbmcgJHt0aGlzLmFjY2Vzc29yeS5kaXNwbGF5TmFtZX0uICBTY2VuZSB3aWxsIHR1cm4gb24gZm9yIDVzIGFuZCB0aGVuIG9mZi5gKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaWxsdW1pbmF0ZVRoZW1lKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDMwMDApO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbGx1bWluYXRlVGhlbWUoMCk7XG4gICAgICAgIH0pXG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuZ2V0Q3VycmVudFN0YXRlQXN5bmMoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldENoYXJhY3RlcmlzdGljcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKGAke3RoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lfSBzZXRTZXJ2aWNlcyBlcnJvcjogJHtlcnJ9YClcbiAgICAgICAgfVxuICAgICAgICAvLyBkb24ndCByZWdpc3RlciBcImZha2VcIiBpbGx1bWF0ZS9leHRpbmd1aXNoIGFsbCB0aGVtZXMuXG4gICAgICAgIC8vIGRvbid0IHJlZ2lzdGVyIGFueSB0aGVtZXMgYmVjYXVzZSB3ZSBkb24ndCBjYXJlIGlmIHRoZSBjb250cm9sbGVyIHRoaW5rcyB0aGV5IGFyZSBvbjtcbiAgICAgICAgLy8gd2Ugd2FudCB0aGVtIHRvIHNob3cgYXMgJ29mZicgc28gdGhleSBjYW4gYWN0IGFzIGEgcHVzaCBidXR0b25cbiAgICAgICAgLyogaWYgKHRoaXMuY29udGV4dC50aGVtZUluZGV4IDwgMTAwKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIucmVnaXN0ZXJDYWxsYmFjayh0aGlzLmFjY2Vzc29yeS5VVUlELCB0aGlzLmNvbnRleHQudHlwZSwgdGhpcy5jb250ZXh0LnRoZW1lSW5kZXgsIHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuT24sIHRoaXMuY2FsbGJhY2tCcmlnaHRuZXNzLmJpbmQodGhpcykpO1xuICAgICAgICB9ICovXG4gICAgfVxuICAgIGdldE9uKGNhbGxiYWNrOiBDaGFyYWN0ZXJpc3RpY0dldENhbGxiYWNrKTogdm9pZCB7XG4gICAgICAgIC8vIFRoZW1lcyBzaG91bGQgYWx3YXlzIHNob3cgYXMgb2ZmXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIDApO1xuICAgIH1cbiAgICBzZXRPbihkZXNpcmVkT246IGJvb2xlYW4sIGNhbGxiYWNrOiBDaGFyYWN0ZXJpc3RpY1NldENhbGxiYWNrKTogdm9pZCB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwpOyAgLy8gY2FsbCBjYWxsYmFjayBmaXJzdCBzbyB3ZSBkb24ndCBlbmNvdW50ZXIgNnMgZGVsYXkgYW5kIGRvd25zdHJlYW0gc3RhdHVzJyBjYW4gdXBkYXRlIHByb3Blcmx5XG4gICAgICAgIHNldFRpbWVvdXQoYXN5bmMgKCkgPT4geyBhd2FpdCB0aGlzLmlsbHVtaW5hdGVUaGVtZSgpLCAxMDAgfSk7XG4gICAgfTtcblxuICAgIGFzeW5jIGlsbHVtaW5hdGVUaGVtZShkZXNpcmVkU3RhdGU6IG51bWJlciA9IDEpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYCR7dGhpcy5hY2Nlc3NvcnkuZGlzcGxheU5hbWV9IHR1cm5pbmcgJHtkZXNpcmVkU3RhdGUgPT09IDEgPyAnb24nIDogJ29mZid9YClcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbnRleHQudGhlbWVJbmRleCA9PT0gMTAxKSB7XG4gICAgICAgICAgICAgICAgLy9hbGwgb2ZmXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jb250cm9sbGVyLkV4dGluZ3Vpc2hBbGxBc3luYygpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VydmljZS51cGRhdGVDaGFyYWN0ZXJpc3RpYyh0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLk9uLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZXh0LmlzT24gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuT25PZmYgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnRleHQudGhlbWVJbmRleCA9PT0gMTAwKSB7XG4gICAgICAgICAgICAgICAgLy9hbGwgb25cbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuSWxsdW1pbmF0ZUFsbEFzeW5jKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuT24sIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuaXNPbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5Pbk9mZiA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGVtZSBpcyBvbiAob24gdGhlIGx1eG9yKSB0dXJuIGl0IG9mZiBzbyB3ZSBjYW4gdHVybiBpdCBvbi4gIEl0IHdvbid0IFxuICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgdGhlbWUgaWYgaXQgaXMgYWxyZWFkeSBcIm9uXCIgZXZlbiBpZiBvdGhlciBsaWdodHMgaGF2ZSBjaGFuZ2VkXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jb250cm9sbGVyLklsbHVtaW5hdGVUaGVtZUFzeW5jKHRoaXMuY29udGV4dC50aGVtZUluZGV4LCAwKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVzaXJlZFN0YXRlID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jb250cm9sbGVyLklsbHVtaW5hdGVUaGVtZUFzeW5jKHRoaXMuY29udGV4dC50aGVtZUluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuT24sIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuaXNPbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5Pbk9mZiA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29udGV4dC5pc09uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5pc09uID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5Pbk9mZiA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRvbid0IGFjdHVhbGx5IHR1cm4gb2Ygc3dpdGNoIG9yIGl0IHdpbGwgdHVybiBvZmYgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgIC8vIGF3YWl0IHRoaXMuY29udHJvbGxlci5JbGx1bWluYXRlVGhlbWVBc3luYyh0aGlzLmNvbnRleHQudGhlbWVJbmRleCwgdGhpcy5jb250ZXh0Lk9uT2ZmKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuT24sIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNvbnRyb2xsZXIudXBkYXRlTGlnaHRzKHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKGAke3RoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lfSBpbGx1bWluYXRlVGhlbWU6ICR7ZXJyfWApXG4gICAgICAgIH1cbiAgICB9O1xuICAgIHNldENoYXJhY3RlcmlzdGljcygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuT24sIHR5cGVvZiB0aGlzLmNvbnRleHQuaXNPbiAhPT0gJ3VuZGVmaW5lZCcgPyB0aGlzLmNvbnRleHQuaXNPbiA6IGZhbHNlKTtcbiAgICB9XG4gICAgLy8gdGhpcyBtZXRob2QgdXNlZCBmb3IgZXZlbnQgaGFuZGxpbmdcbiAgICBhc3luYyBnZXRDdXJyZW50U3RhdGVBc3luYygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgLy90aGVtZXMgc2hvdWxkIGFsd2F5cyBzaG93IGFzIG9mZiBldmVuIGlmIHRoZSBjb250cm9sbGVyIGhhcyB0aGUgc3RhdGUgb2YgJ29uJ1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmlzT24gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5Pbk9mZiA9IDA7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKXtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKGAke3RoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lfSBnZXRDdXJyZW50U3RhdGVBc3luYyBlcnJvcjogJHtlcnJ9YCk7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy8gdGhpcyBtZXRob2QgdXNlZCBmb3IgY2FsbGJhY2tzXG4gICAgYXN5bmMgY2FsbGJhY2tPbihpc09uOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jb250ZXh0LmlzT24gIT09IGlzT24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5kZWJ1ZyhgJHt0aGlzLmFjY2Vzc29yeS5kaXNwbGF5TmFtZX0gdXBkYXRlZCBpc09uIHRvICR7aXNPbiA/ICdvbicgOiAnb2ZmJ30uYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZXh0LmlzT24gPSBpc09uO1xuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5Pbk9mZiA9IGlzT24gPyAxIDogMDtcbiAgICAgICAgICAgICAgICB0aGlzLnNlcnZpY2UudXBkYXRlQ2hhcmFjdGVyaXN0aWModGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5PbiwgdGhpcy5jb250ZXh0LmlzT24pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHsgdGhpcy5sb2cuZXJyb3IoZXJyKTsgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7IH1cbiAgICB9XG59Il19