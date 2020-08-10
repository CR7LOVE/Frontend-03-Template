const http = require('http');

http
    .createServer((request, response) => {
        let body = [];
        request
            .on('error', (err) => {
                console.error(err);
            })
            .on('data', (chunk) => {
                console.log('chunk', chunk)
                // body.push(chunk.toString());
                body.push(Buffer.from(chunk))
            })
            .on('end', () => {
                console.log('body 上', body)
                console.log('body concat', body)
                body = Buffer.concat(body).toString();
                console.log("body:", body);
                response.writeHead(200, {
                    'Content-Type': 'text/html'
                });
                response.end(' Hello World\n');
            })
    })
    .listen(8088);

console.log("server started");