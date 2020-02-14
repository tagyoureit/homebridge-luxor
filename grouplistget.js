// group list get

var rp = require('request-promise');

let ip = '10.0.1.15'

var post_options = {
    url: 'http://' + ip + '/GroupListGet.json',
    method: 'POST'
};
console.log(`trying to connect to:\n${JSON.stringify(post_options)}`)
console.time('requestTime')
return rp(post_options)
    .then(function(body) {
        var info = JSON.parse(body);
        console.log(`retrieved info object: ${JSON.stringify(info,null,2)}`)
    })
    .catch(function(err) {
        console.error(`was not able to retrieve light groups from controller.  ${err}\n${err.message}`);
    })
    .finally(function() {
        console.timeEnd('requestTime')
    })