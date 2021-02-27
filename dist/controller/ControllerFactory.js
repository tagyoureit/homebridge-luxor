"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerFactory = void 0;
const ZD_Controller_1 = require("./ZD_Controller");
const ZDC_Controller_1 = require("./ZDC_Controller");
const ZDTWO_Controller_1 = require("./ZDTWO_Controller");
const BaseController_1 = require("./BaseController");
class ControllerFactory {
    static createController(controller, log) {
        switch (controller.type) {
            case BaseController_1.IControllerType.ZD:
                return new ZD_Controller_1.ZD_Controller(controller, log);
            case BaseController_1.IControllerType.ZDC:
                return new ZDC_Controller_1.ZDC_Controller(controller, log);
            case BaseController_1.IControllerType.ZDTWO:
                return new ZDTWO_Controller_1.ZDTWO_Controller(controller, log);
            default:
                return new BaseController_1.BaseController(controller, log);
        }
    }
}
exports.ControllerFactory = ControllerFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29udHJvbGxlckZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlci9Db250cm9sbGVyRmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtREFBZ0Q7QUFDaEQscURBQWtEO0FBQ2xELHlEQUFzRDtBQUN0RCxxREFBbUU7QUFFbkUsTUFBYSxpQkFBaUI7SUFDckIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxHQUFHO1FBQzVDLFFBQVEsVUFBVSxDQUFDLElBQUksRUFBRTtZQUN2QixLQUFLLGdDQUFlLENBQUMsRUFBRTtnQkFDckIsT0FBTyxJQUFJLDZCQUFhLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzVDLEtBQUssZ0NBQWUsQ0FBQyxHQUFHO2dCQUN0QixPQUFPLElBQUksK0JBQWMsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDN0MsS0FBSyxnQ0FBZSxDQUFDLEtBQUs7Z0JBQ3hCLE9BQU8sSUFBSSxtQ0FBZ0IsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDL0M7Z0JBQ0UsT0FBTyxJQUFJLCtCQUFjLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQzlDO0lBQ0gsQ0FBQztDQUNGO0FBYkQsOENBYUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBaRF9Db250cm9sbGVyIH0gZnJvbSAnLi9aRF9Db250cm9sbGVyJztcbmltcG9ydCB7IFpEQ19Db250cm9sbGVyIH0gZnJvbSAnLi9aRENfQ29udHJvbGxlcic7XG5pbXBvcnQgeyBaRFRXT19Db250cm9sbGVyIH0gZnJvbSAnLi9aRFRXT19Db250cm9sbGVyJztcbmltcG9ydCB7IEJhc2VDb250cm9sbGVyLCBJQ29udHJvbGxlclR5cGUgfSBmcm9tICcuL0Jhc2VDb250cm9sbGVyJztcblxuZXhwb3J0IGNsYXNzIENvbnRyb2xsZXJGYWN0b3J5IHtcbiAgcHVibGljIHN0YXRpYyBjcmVhdGVDb250cm9sbGVyKGNvbnRyb2xsZXIsIGxvZykge1xuICAgIHN3aXRjaCAoY29udHJvbGxlci50eXBlKSB7XG4gICAgICBjYXNlIElDb250cm9sbGVyVHlwZS5aRDpcbiAgICAgICAgcmV0dXJuIG5ldyBaRF9Db250cm9sbGVyKGNvbnRyb2xsZXIsIGxvZyk7XG4gICAgICBjYXNlIElDb250cm9sbGVyVHlwZS5aREM6XG4gICAgICAgIHJldHVybiBuZXcgWkRDX0NvbnRyb2xsZXIoY29udHJvbGxlciwgbG9nKTtcbiAgICAgIGNhc2UgSUNvbnRyb2xsZXJUeXBlLlpEVFdPOlxuICAgICAgICByZXR1cm4gbmV3IFpEVFdPX0NvbnRyb2xsZXIoY29udHJvbGxlciwgbG9nKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBuZXcgQmFzZUNvbnRyb2xsZXIoY29udHJvbGxlciwgbG9nKTtcbiAgICB9XG4gIH1cbn0iXX0=