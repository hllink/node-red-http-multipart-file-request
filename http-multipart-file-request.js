// require in libs
var mustache = require('mustache'),
    request = require('request'),
    fs = require('fs');

module.exports = function (RED) {
    function httpSendMultipart(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.ret = n.ret || "txt";
        if (RED.settings.httpRequestTimeout) {
            this.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 60000;
        } else {
            this.reqTimeout = 60000;
        }

        this.on("input", function (msg) {
            node.status({
                fill: "blue",
                shape: "dot",
                text: "Sending multipart request..."
            });
            var url = msg.url;
            if (!url) {
                node.error(RED._("httpSendMultipart.errors.no-url"), msg);
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: (RED._("httpSendMultipart.errors.no-url"))
                });
                return;
            }
            let formData = msg.formdata || {}
            if (msg.formfiles && msg.formfiles.length > 0) {
                for (let i = 0; i < msg.formfiles.length; i++) {
                    let formfile = msg.formfiles[i]
                    var filePath = '/tmp/' + i +formfile.originalname
                    fs.writeFileSync(filePath, formfile.buffer);
                    if (formData[formfile.fieldname]) {
                        if (Array.isArray(formData[formfile.fieldname])) {
                            formData[formfile.fieldname].push(fs.createReadStream(filePath))
                        } else {
                            formData[formfile.fieldname] = [formData[formfile.fieldname],fs.createReadStream(filePath)]
                        }
                    } else {
                        formData[formfile.fieldname] = fs.createReadStream(filePath)
                    }
                }
            }
            if (this.credentials && this.credentials.user) {
                var urlTail = url.substring(url.indexOf('://') + 3);
                var username = this.credentials.user,
                    password = this.credentials.password;
                url = 'https://' + username + ':' + password + '@' + urlTail;

            }

            let headers = msg.headers || { "Content-Type": "multipart/form-data" }

            const options = {
                method: "POST",
                url: url,
                headers: headers,
                formData: formData
            };

            var thisReq = request.post(options, function (err, resp, body) {
                if (msg.formfiles && msg.formfiles.length > 0) {
                    for (let i = 0; i < msg.formfiles.length; i++) {
                        let formfile = msg.formfiles[i]
                        var filePath = '/tmp/' +i+ formfile.originalname
                        fs.unlink(filePath, function (error) {
                            if (error) {
                                throw error;
                            }
                            console.log('Deleted ' + filePath + "!!");
                        });
                    }
                }
                if (err || !resp) {
                    // node.error(RED._("httpSendMultipart.errors.no-url"), msg);
                    var statusText = "Unexpected error";
                    if (err) {
                        statusText = err;
                    } else if (!resp) {
                        statusText = "No response object";
                    }
                    node.status({
                        fill: "red",
                        shape: "ring",
                        text: statusText
                    });
                } else {
                    node.status({
                        fill: "green",
                        shape: "ring",
                        text: "Message sent successfully"
                    });
                }
                msg.payload = body;
                msg.statusCode = resp.statusCode || resp.status;
                msg.headers = resp.headers;

                if (node.ret !== "bin") {
                    msg.payload = body.toString('utf8'); // txt

                    if (node.ret === "obj") {
                        try {
                            msg.payload = JSON.parse(body);
                        } catch (e) {
                            node.warn(RED._("httpSendMultipart.errors.json-error"));
                        }
                    }
                }

                node.send(msg);
            });
        });

    }

    RED.nodes.registerType("http-multipart-file-request", httpSendMultipart, {
        credentials: {
            user: {
                type: "text"
            },
            password: {
                type: "password"
            }
        }
    });

};
