export class Player {
    constructor(parser, url, callback = null) {
        this.chunk = null;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    let buffer = new Uint8Array(xhr.response);
                    parser.parse(buffer);
                    if (callback !== null) {
                        callback(parser.chunk);
                    }
                } else {
                    console.error(xhr.statusText);
                }
            }
        };
        xhr.send();
    }
}