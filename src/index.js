const Koa = require('koa');
const KoaBody = require('koa-body');
const Router = require('@koa/router');
const CronJob = require('cron');

const { GetSSLTxt, RestartNginx, CreateSSL, CheckSSLTime } = require('./ssl');
const DingDing = require('./dingding');

const app = new Koa();

app.use(KoaBody());

//加载路由
const router = new Router();

// 监听证书文件的校验
router.use('/.well-known/acme-challenge/:name', function (ctx) {
    const name = ctx.params.name;
    ctx.body = GetSSLTxt(name);
});
app.use(router.routes()).use(router.allowedMethods());

const DOMAIN = 'guofangchao.com';
const EMAIL = 'aaaa@aa.com';
// 启动定时任务
new CronJob('0 0 1 * * *', async function () {
    // 检查域名是否过期
    try {
        // 获取剩余天数
        const days = await CheckSSLTime(DOMAIN);
        if (days < 2) {
            DingDing('域名过期', `${DOMAIN} 剩余 ${days} 天`);
            // 开始自动创建
            await CreateSSL(DOMAIN, EMAIL);
            // 移动文件和重启nginx
            RestartNginx();
        }
    } catch (error) {
        console.log(error);
    }
}).start();

// 启动服务
const port = process.env.PORT || '8087';
app.listen(port, function () {
    console.log(`服务器运行在http://127.0.0.1:${port}`);
});
