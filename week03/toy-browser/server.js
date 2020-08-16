const http = require('http');

let html =
    `<html maaa="a">
<head>
<style>
body div #myid {
    width: 100px;
    background: blue;
}
body div img {
    width: 30px;
    background: yellow;
}
</style>
</head>
<body>
<div>
<img id="myid"/>
<img/>
</div>
</body>
</html>`;

http
    .createServer((request, response) => {
        let body = [];
        request
            .on('error', (err) => {
                console.error(err);
            })
            .on('data', (chunk) => {
                // body.push(chunk.toString());
                body.push(Buffer.from(chunk))
            })
            .on('end', () => {
                body = Buffer.concat(body).toString();
                response.writeHead(200, {
                    'Content-Type': 'text/html'
                });
                // response.end(' Hello World\n');

                response.end(html)
            })
    })
    .listen(8088);

console.log("server started");