"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LightFactory = void 0;
const ZD_Light_1 = require("./ZD_Light");
const ZDC_Light_1 = require("./ZDC_Light");
const Theme_1 = require("./Theme");
class LightFactory {
    static createLight(platform, accessory) {
        switch (accessory.context.type) {
            case ZD_Light_1.ILightType.ZD:
                return new ZD_Light_1.ZD_Light(platform, accessory);
            case ZD_Light_1.ILightType.ZDC:
                return new ZDC_Light_1.ZDC_Light(platform, accessory);
            case ZD_Light_1.ILightType.THEME:
                return new Theme_1.Theme(platform, accessory);
            default:
                platform.log.error(`Light type ${accessory.context.type} could not be found.`);
        }
    }
}
exports.LightFactory = LightFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTGlnaHRGYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2xpZ2h0cy9MaWdodEZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUNBQWtEO0FBQ2xELDJDQUF3QztBQUN4QyxtQ0FBZ0M7QUFHaEMsTUFBYSxZQUFZO0lBQ2hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBdUIsRUFBRSxTQUE0QjtRQUM3RSxRQUFRLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO1lBQzlCLEtBQUsscUJBQVUsQ0FBQyxFQUFFO2dCQUNoQixPQUFPLElBQUksbUJBQVEsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDM0MsS0FBSyxxQkFBVSxDQUFDLEdBQUc7Z0JBQ2pCLE9BQU8sSUFBSSxxQkFBUyxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1QyxLQUFLLHFCQUFVLENBQUMsS0FBSztnQkFDbkIsT0FBTyxJQUFJLGFBQUssQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDeEM7Z0JBQ0UsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsY0FBYyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksc0JBQXNCLENBQUMsQ0FBQTtTQUNqRjtJQUNILENBQUM7Q0FDRjtBQWJELG9DQWFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSUxpZ2h0VHlwZSwgWkRfTGlnaHQgfSBmcm9tICcuL1pEX0xpZ2h0JztcbmltcG9ydCB7IFpEQ19MaWdodCB9IGZyb20gJy4vWkRDX0xpZ2h0JztcbmltcG9ydCB7IFRoZW1lIH0gZnJvbSAnLi9UaGVtZSc7XG5pbXBvcnQgeyBMdXhvclBsYXRmb3JtIH0gZnJvbSAnLi4vTHV4b3JQbGF0Zm9ybSc7XG5pbXBvcnQgeyBQbGF0Zm9ybUFjY2Vzc29yeSB9IGZyb20gJ2hvbWVicmlkZ2UnO1xuZXhwb3J0IGNsYXNzIExpZ2h0RmFjdG9yeSB7XG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlTGlnaHQocGxhdGZvcm06IEx1eG9yUGxhdGZvcm0sIGFjY2Vzc29yeTogUGxhdGZvcm1BY2Nlc3NvcnkpIHtcbiAgICBzd2l0Y2ggKGFjY2Vzc29yeS5jb250ZXh0LnR5cGUpIHtcbiAgICAgIGNhc2UgSUxpZ2h0VHlwZS5aRDpcbiAgICAgICAgcmV0dXJuIG5ldyBaRF9MaWdodChwbGF0Zm9ybSwgYWNjZXNzb3J5KTtcbiAgICAgIGNhc2UgSUxpZ2h0VHlwZS5aREM6XG4gICAgICAgIHJldHVybiBuZXcgWkRDX0xpZ2h0KHBsYXRmb3JtLCBhY2Nlc3NvcnkpO1xuICAgICAgY2FzZSBJTGlnaHRUeXBlLlRIRU1FOlxuICAgICAgICByZXR1cm4gbmV3IFRoZW1lKHBsYXRmb3JtLCBhY2Nlc3NvcnkpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcGxhdGZvcm0ubG9nLmVycm9yKGBMaWdodCB0eXBlICR7YWNjZXNzb3J5LmNvbnRleHQudHlwZX0gY291bGQgbm90IGJlIGZvdW5kLmApXG4gICAgfVxuICB9XG59Il19