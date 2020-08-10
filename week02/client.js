const net = require("net");

// 4
class TrunkedBodyParser {
    constructor() {
        // trunk body 的结构是：一个长度后面跟一个 Trunk 的内容，遇到长度为 0 的 chunk，body 就结束了
        this.WAITING_LENGTH = 0; // 处理长度
        this.WAITING_LENGTH_LINE_END = 1; // 处理长度

        this.READING_TRUNK = 2;

        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;

        this.length = 0;
        this.content = [];
        this.isFinished = false;
        this.current = this.WAITING_LENGTH;
    }

    receiveChar(char) {
        if (this.current === this.WAITING_LENGTH) {
            if (char === '\r') {
                if (this.length === 0) {
                    this.isFinished = true;
                }
                this.current = this.WAITING_LENGTH_LINE_END;
            } else {
                this.length *= 16;
                this.length += parseInt(char, 16);
            }
        } else if (this.current === this.WAITING_LENGTH_LINE_END) {
            if (char === '\n') {
                this.current = this.READING_TRUNK;
            }
        } else if (this.current === this.READING_TRUNK) {
            this.content.push(char);
            this.length--;
            if (this.length === 0) {
                this.current = this.WAITING_NEW_LINE;
            }
        } else if (this.current === this.WAITING_NEW_LINE) {
            if (char === '\r') {
                this.current = this.WAITING_NEW_LINE_END;
            }
        } else if(this.current === this.WAITING_NEW_LINE_END) {
            if (char === '\n') {
                this.current = this.WAITING_LENGTH;
            }
        }
    }
}

// 3
class ResponseParser {
    constructor() {
        // status line
        this.WAITING_STATUS_LINE = 0;
        this.WAITING_STATUS_LINE_END = 1;

        // header
        this.WAITING_HEADER_NAME = 2;
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4;
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;

        // body
        this.WAITING_BODY = 7;

        this.current = this.WAITING_STATUS_LINE;
        this.statusLine = "";
        this.headers = {};
        this.headerName = "";
        this.headerValue = "";
        this.bodyParser = null;
    }

    receive(string) {
        for (let i = 0; i < string.length; i++) {
            this.receiveChar(string.charAt(i));
        }
    }

    get isFinished() {
        return this.bodyParser && this.bodyParser.isFinished;
    }

    get response() {
        this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
        return {
            statusCode: RegExp.$1,
            statusText: RegExp.$2,
            headers: this.headers,
            body: this.bodyParser.content.join('')
        }
    }

    // 状态机
    receiveChar(char) {
        if(this.current === this.WAITING_STATUS_LINE) {
            if(char === '\r') {
                this.current = this.WAITING_STATUS_LINE_END;
                
            } else {
                this.statusLine += char;
                
            }
        } else if (this.current === this.WAITING_STATUS_LINE_END) {
            if (char === '\n') {
                this.current = this.WAITING_HEADER_NAME;
            }
        } else if (this.current === this.WAITING_HEADER_NAME) {
            if(char === ':') {
                this.current = this.WAITING_HEADER_SPACE;
            } else if(char === '\r') {
                this.current = this.WAITING_HEADER_BLOCK_END;
                if(this.headers['Transfer-Encoding'] === 'chunked') { // 有各种值，node 默认是 chunked
                    this.bodyParser = new TrunkedBodyParser();
                }
            } else {
                this.headerName += char;
            }
        } else if(this.current === this.WAITING_HEADER_SPACE) {
            if (char === ' ') { // 分隔 header 的 KV
                this.current = this.WAITING_HEADER_VALUE;
            }
        } else if (this.current === this.WAITING_HEADER_VALUE) {
            if (char === '\r') {
                this.current = this.WAITING_HEADER_LINE_END;
                this.headers[this.headerName] = this.headerValue;
                this.headerName = '';
                this.headerValue = '';
            } else {
                this.headerValue += char;
            }
        } else if (this.current === this.WAITING_HEADER_LINE_END) {
            if(char === '\n') {
                this.current = this.WAITING_HEADER_NAME;
            }
        } else if (this.current === this.WAITING_HEADER_BLOCK_END) {
            if (char === '\n') {
                this.current = this.WAITING_BODY;
            }
        } else if(this.current === this.WAITING_BODY) {
            this.bodyParser.receiveChar(char)
        }
    }
}

// 2
class Request {
    constructor(options) {
        this.method = options.method || "GET";
        this.host = options.host;
        this.port = options.port || 80;
        this.path = options.path || "/";
        this.body = options.body || {};
        this.headers = options.headers || {};

        if(!this.headers["Content-Type"]) {
            this.headers["Content-Type"] = "application/x-www-form-urlencoded"
        }

        if(this.headers["Content-Type"] === "application/json") {
            this.bodyText = JSON.stringify(this.body);
        } else if (this.headers["Content-Type"] === "application/x-www-form-urlencoded") {
            this.bodyText = Object.keys(this.body)
                .map(key => `${key}=${encodeURIComponent(this.body[key])}`)
                .join('&');
        }

        this.headers["Content-Length"] = this.bodyText.length;
    }

    send(connection) {
        // 没有传 connection 的话，就去创建一个新的 TCP 连接
        return new Promise((resolve, reject) => {
            const parser = new ResponseParser();
            
            if (connection) {
                connection.write(this.toString());
            } else {
            
                connection = net.createConnection({
                    host: this.host,
                    port: this.port
                }, () => {
            
                    connection.write(this.toString())
                })
            }

            connection.on('data', (data) => {
                parser.receive(data.toString());
                if(parser.isFinished) {
                    resolve(parser.response);
                    connection.end();
                }
            });

            connection.on('error', (err) => {
                reject('aaa error 了', err);
                connection.end();
            })
        })
    }

    // 助教给的，TODO：记笔记
    toString() {
        let stream = [
            `${this.method} ${this.path} HTTP/1.1\r\n`,
            ...Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}\r\n`),
            '\r\n',
            `${this.bodyText}\r\n`
        ];
        return stream.join('');
    }
}

// 1
void async function () {
    let request = new Request({
        method: "POST",
        host: "127.0.0.1",
        port: "8088",
        path: "/",
        headers: {
            ["X-Foo2"]: "customed"
        },
        body: {
            name: "zhangcan"
        }
    });

    let response = await request.send();

    console.log(response)
}();





