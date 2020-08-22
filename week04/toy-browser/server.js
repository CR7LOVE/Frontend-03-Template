const http = require('http');

let html =
    `<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <title>Title</title>
    <style>
        html {
            background-color: black;
        }
        #container {
            width: 500px;
            height: 300px;
            display: flex;
            background-color: white;
        }
        #container #one {
            width: 200px;
            height: 200px;
            background-color: red;
        }
        #container .c1  {
            flex: 1;
            background-color: green;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="one">1</div>
        <div class="c1">2</div>
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