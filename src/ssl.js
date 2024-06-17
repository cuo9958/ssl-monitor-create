const Greenlock = require('greenlock');
const path = require('path');
const fs = require('fs');
const GreenlockStoreFs = require('greenlock-store-fs');
const LeChallengeFs = require('le-challenge-fs');
const https = require('https');
const dayjs = require('dayjs');
const { execSync } = require('child_process');

// ==========================启动执行的任务================================
// SSL根目录
const ROOT_PATH = path.join(process.cwd(), 'ssl');
// 证书文件目录
const PEM_PATH = path.join(ROOT_PATH, 'pem');
if (!fs.existsSync(PEM_PATH)) {
    fs.mkdirSync(PEM_PATH);
}
// 创建存储对象
const leStore = GreenlockStoreFs.create({
    configDir: path.join(ROOT_PATH, 'letsencrypt'),
});
// 创建验证对象
const leHttpChallenge = LeChallengeFs.create({
    webrootPath: path.join(ROOT_PATH, 'lechallenge'),
});
// 是否同意协议
function leAgree(opts, agreeCb) {
    agreeCb(null, opts.tosUrl);
}

// 证书申请对象
const greenlock = Greenlock.create({
    version: 'draft-12',
    // 测试环境
    // server: 'https://acme-staging-v02.api.letsencrypt.org/directory',
    // 生产环境
    server: 'https://acme-v02.api.letsencrypt.org/directory',
    store: leStore,
    challenges: {
        'http-01': leHttpChallenge,
    },
    challengeType: 'http-01',
    agreeToTerms: leAgree,
    debug: false,
    renewBy: 10 * 24 * 60 * 60 * 1000,// 10倒计时开始续期
});

// 计算2个Date对象之间的天数
function getTimeDay(date1,date2){
    return Math.floor((date2-date1)/(24*60*60*1000));
}

// =========================对外提供服务的接口=================================
// 创建SSL证书申请请求
async function CreateSSL(domain, email = '') {
    const results = await greenlock.register({
        domains: [domain],
        email,
        agreeTos: true,
        rsaKeySize: 2048,
    });
    // 如果生成证书就保存一次证书
    const dir = path.join(PEM_PATH, domain);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    if (results.cert && results.chain) {
        fs.writeFileSync(path.join(dir, 'csr.pem'), results.cert + results.chain, 'utf-8');
    }
    if (results.privkey) {
        fs.writeFileSync(path.join(dir, 'key.pem'), results.privkey, 'utf-8');
    }
    return results;
}
// 获取验证文件内容
function GetSSLTxt(name) {
    const str = fs.readFileSync(path.join(ROOT_PATH, 'lechallenge', name), 'utf-8');
    return str;
}
// 获取证书文件路径
function GetSSLFilePath(domain, name) {
    return path.join(PEM_PATH, domain, name + '.pem');
}
/**
 * 获取证书文本内容
 * @param {*} domain
 * @param {*} type 'key' | 'csr'
 * @returns
 */
function GetPem(domain, type) {
    return fs.readFileSync(path.join(PEM_PATH, domain, `${type}.pem`), 'utf-8');
}
// 检查SSL的剩余天数
function CheckSSLTime(hostname) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: hostname,
            port: 443,
            method: 'GET',
        };
        const req = https.request(options, (res) => {
            const certificate = res.socket.getPeerCertificate();
            if (certificate.valid_from && certificate.valid_to) {
                // const start = dayjs(certificate.valid_from);
                const end = dayjs(certificate.valid_to);
                const timespan = end.diff(dayjs(), 'day');
                resolve(timespan);
            } else {
                resolve(0);
            }
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}
// 执行重启命令
function RestartNginx() {
    execSync('nginx -s reload', {
        encoding: 'utf-8',
        // cwd: "~/",
        shell: '/bin/bash',
    });
}
module.exports = {
    CreateSSL,
    GetSSLFilePath,
    GetSSLTxt,
    GetPem,
    CheckSSLTime,
    RestartNginx,
};
