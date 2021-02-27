"use strict";
require('source-map-support').install();
const LuxorPlatform_1 = require("./LuxorPlatform");
module.exports = (api) => {
    api.registerPlatform("homebridge-luxor", "Luxor", LuxorPlatform_1.LuxorPlatform);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBRXhDLG1EQUFnRDtBQUdoRCxpQkFBUyxDQUFDLEdBQVEsRUFBRSxFQUFFO0lBQ2xCLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsNkJBQWEsQ0FBQyxDQUFDO0FBQ3JFLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpLmluc3RhbGwoKTtcbmltcG9ydCB7IEFQSSB9IGZyb20gJ2hvbWVicmlkZ2UnO1xuaW1wb3J0IHsgTHV4b3JQbGF0Zm9ybSB9IGZyb20gJy4vTHV4b3JQbGF0Zm9ybSc7XG5cblxuZXhwb3J0ID0gKGFwaTogQVBJKSA9PiB7XG4gICAgYXBpLnJlZ2lzdGVyUGxhdGZvcm0oXCJob21lYnJpZGdlLWx1eG9yXCIsIFwiTHV4b3JcIiwgTHV4b3JQbGF0Zm9ybSk7XG59O1xuIl19