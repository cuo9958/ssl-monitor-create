import crypto from 'crypto';
import axios from 'axios';

//替换成自己的钉钉KEY
const DD_KEY = 'SEC123456789';
const DD_Token = 'b6f123456789';

async function postToDD(data) {
    const timestamp = Date.now();
    const sha = crypto.createHmac('SHA256', DD_KEY);
    sha.update(timestamp + '\n' + DD_KEY, 'utf8');
    const sign = encodeURI(sha.digest('base64'));
    await axios.post(`https://oapi.dingtalk.com/robot/send?access_token=${DD_Token}&timestamp=${timestamp}&sign=${sign}`, data);
}

module.exports = function (title, message) {
    return postToDD({
        msgtype: 'markdown',
        markdown: {
            title,
            text: message,
        },
    });
};
