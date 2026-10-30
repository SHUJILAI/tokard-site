# Tokard（原 ChinaAPI）：国产顶尖模型 API 出海平台

> **2026-10 更新，部署前先读：**
> - 账号、卡、翻牌、商店、Stripe 收款都已改到我们自己的 web 服务，new-api 只负责计量和转发。
> - Stripe webhook 改为 `https://<SITE_DOMAIN>/api/stripe/webhook`，不再填 admin 域名，new-api 后台里的 Stripe 设置留空。
> - 需要的新密钥和 issuer 访问令牌见 `.env.example`。
> - 安全设计和上线清单见 `SECURITY.md`。攻击测试：`cd web && npm run test:attack`。
> - 产品与设计规则见 `AGENTS.md`。下文旧版说明里与此冲突的，以这几份文件为准。

只卖三个模型，每个都是最新版：

| 用户填的模型名 | 背后的模型 | 上游 |
|---|---|---|
| `text` | DeepSeek V4.1 Flash | DeepSeek 官方 API（也可换成海外托管的开源权重） |
| `image` | Seedream 5.0 Pro（即梦 / Dreamina 的图片模型） | BytePlus ModelArk（字节海外版） |
| `video` | Seedance 2.5 | BytePlus ModelArk |

上游出新版本时，只改后台的"模型重定向"，用户的代码一行不用改。想固定版本的用户写 `text@2026-10`。

## 网站有哪几页

全部是我们自己的设计，用户看不到开源网关的界面：

| 页面 | 地址 | 做什么 |
|---|---|---|
| 首页 | `/` | 三个模型和 logo、代码示例、对比、价格、三步上手 |
| 定价 | `/pricing` | 价格表、月费用估算器、套餐、常见问题 |
| Playground | `/playground` | 选文字 / 图片 / 视频，填提示词，直接用自己的 Key 真实调用，旁边给出对应代码 |
| Studio | `/studio` | 多模态 Agent：DeepSeek 对话，自己决定何时调 Seedream 出图、Seedance 出视频；可附图改图、让图动起来 |
| 控制台 | `/console` | 注册登录、API Key（显示 / 复制 / 新建 / 删除）、余额、本月用量、最近调用、银行卡充值、兑换码、开通套餐 |

控制台里显示或复制过 Key 之后，同一浏览器里的 Playground 和 Studio 会自动用这个 Key，不用再粘贴。

## 整体结构

```
  chinaapi.ai ─────────┐
                       ├──▶ web（我们自己写的）
  api.chinaapi.ai ─────┘     · 五个页面
                             · /v1/*：对外 API，把 image / video / text@日期 换成网关认识的名字
                             · /api/*：控制台用的账号接口，只放行用户级接口，原样转给 new-api
                                │
  admin.chinaapi.ai ──▶ new-api（开源网关，不改源码，只给你自己用的后台）
                                │  注册 · Key · 余额 · 计费 · 套餐 · 支付 · 转发
                                ▼
                     DeepSeek API      BytePlus ModelArk（Seedream / Seedance）
```

- **new-api**（github.com/QuantumNous/new-api）负责中转站的全部"后端"：账号、Key、余额、用量日志、渠道路由、失败重试、Stripe 收款、套餐。我们只配置它，不改它的代码。它自带的网页只当管理后台用，放在 admin 域名。
- **web/** 是我们自己的代码：五个页面、Studio 的 Agent、对外 API 入口、控制台的账号接口转发。
- **Caddy** 自动申请 HTTPS 证书，把三个域名分到对应服务。

## 已经测过的

在测试环境里用 new-api v1.0.0-rc.46 + 模拟的 DeepSeek / BytePlus 上游，用浏览器把整条链路走了一遍：

- 控制台：注册后自动建好 Key、送 $5；显示 / 复制 Key；兑换码到账；用余额开通 Starter 套餐；退出、密码错误提示、重新登录；登录过期后自动续期
- Playground：文字流式输出、出图、出视频（创建 → 进度 → 下载播放），费用和 token 显示正确
- 调用之后控制台的"最近调用"和"本月用量"里能看到，模型名显示为 text / image / video
- `text@2026-10` 能调用；写错日期时返回清楚的错误
- Studio 自动用控制台里的 Key；之前测过的出图、出视频、附图生成照常
- 计费：5 秒 720p 视频 $1.15（= $0.23/秒）；有套餐时先扣套餐额度
- 管理接口（渠道、用户等）从网站域名访问不到
- 五个页面在手机和电脑、浅色和深色下都检查过

没测的：真实的 DeepSeek 和 BytePlus 接口（需要你们的 Key）、Stripe 真实付款（需要 Stripe 账号）。

## 一、先在自己电脑上看效果（不需要任何 Key）

需要 Node 20 以上：

```bash
cd web
npm run demo
```

打开 http://localhost:8080 。演示模式下控制台是一个示例账号，Playground 和 Studio 返回示例图片和视频，用来看流程和界面。

## 二、上线部署

准备：

1. 一台海外服务器（美国或新加坡，2 核 4G 起步），装好 Docker。
2. 三个域名解析到这台服务器：`chinaapi.ai`、`api.chinaapi.ai`、`admin.chinaapi.ai`（换成你们自己的）。
3. 上游账号：DeepSeek 开放平台的 API Key；BytePlus ModelArk 的 API Key，并在控制台开通 Seedream 5.0 Pro 和 Seedance 2.5。

然后：

```bash
cp .env.example .env      # 改域名和两个随机密码
docker compose up -d
```

几分钟后三个域名都能打开，证书自动签好。

## 三、配置 new-api（只需一次）

一条命令完成：建管理员、改品牌、新用户送 $5、加两个渠道、设价格、建 Starter 和 Pro 两个套餐。

```bash
NEWAPI_URL=https://admin.chinaapi.ai \
ADMIN_USER=admin ADMIN_PASS='设置一个强密码' \
DEEPSEEK_API_KEY=sk-... \
BYTEPLUS_API_KEY=... \
SITE_URL=https://chinaapi.ai API_URL=https://api.chinaapi.ai \
node scripts/init-newapi.mjs
```

可选变量：

| 变量 | 作用 | 默认 |
|---|---|---|
| `SEEDREAM_MODEL` | BytePlus 上 Seedream 5.0 Pro 的模型 ID | `seedream-5-0-pro-260628` |
| `SEEDANCE_MODEL` | BytePlus 上 Seedance 2.5 的模型 ID | `dreamina-seedance-2-5-260628` |
| `DEEPSEEK_MODEL` | DeepSeek 的模型名 | `deepseek-flash`（官方指向最新的 V4.1 Flash） |
| `NEW_USER_CREDIT` | 新用户赠送额度（美元） | `5` |
| `STARTER_CREDIT` / `PRO_CREDIT` | 套餐每月可用额度（美元） | `20` / `100` |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` | 套餐对应的 Stripe Price ID，填了就能刷卡订阅 | 不填时只能用余额开通 |
| `ZAI_API_KEY` / `MOONSHOT_API_KEY` | 顺手把 GLM-5.3 / Kimi K3 渠道加上（不上网站） | 不加 |
| `CREATE_STUDIO_TRIAL_KEY=1` | 建一个 $5 额度的试用令牌，打印出来填进 `.env` 的 `STUDIO_TRIAL_KEY` | 不建 |

脚本可以重复运行，不会重复建渠道和套餐。BytePlus 的模型 ID 以你控制台里显示的为准。

脚本跑完，还有两件事只能你本人在 admin 后台点：

1. **「支付设置」里阅读并确认合规声明**。不确认的话，兑换码、刷卡充值、套餐对所有用户都是关闭的（控制台里会自动隐藏这些按钮）。
2. **「支付设置 → Stripe」填 Secret Key 和 Webhook Secret**，Webhook 地址填 `https://admin.chinaapi.ai/api/stripe/webhook`。

价格（脚本已设好，可在后台「模型价格」里改）：

| 模型 | 计费 |
|---|---|
| `text` | 输入 $0.30 / 百万 token，输出 $1.20 / 百万，缓存命中 $0.006 / 百万 |
| `doubao-seedream-5-0-pro-260628` | $0.045 / 张 |
| `doubao-seedance-2-5-260628` | 表达式 `tier("base", u("tokens") * 10.65 / 1000000)`，720p 约 $0.23 / 秒 |

为什么后台里图片和视频叫 `doubao-...`：new-api 的豆包插件只认这些名字，计费和参数检查都靠它。对外的 `image` / `video` 由 web 服务换成它们。

## 四、开发者怎么调用

```bash
# 文字
curl https://api.chinaapi.ai/v1/chat/completions \
  -H "Authorization: Bearer $CHINAAPI_KEY" -H "Content-Type: application/json" \
  -d '{"model":"text","messages":[{"role":"user","content":"你好"}]}'

# 图片
curl https://api.chinaapi.ai/v1/images/generations \
  -H "Authorization: Bearer $CHINAAPI_KEY" -H "Content-Type: application/json" \
  -d '{"model":"image","prompt":"霓虹城市上空的锦鲤，海报风格","size":"2048x1152"}'

# 视频（异步：先创建，再查询，完成后下载）
curl https://api.chinaapi.ai/v1/videos \
  -H "Authorization: Bearer $CHINAAPI_KEY" -H "Content-Type: application/json" \
  -d '{"model":"video","prompt":"一条锦鲤游过夜晚的霓虹城市","seconds":"5","metadata":{"resolution":"720p","ratio":"16:9"}}'
curl https://api.chinaapi.ai/v1/videos/<id> -H "Authorization: Bearer $CHINAAPI_KEY"
curl -o out.mp4 https://api.chinaapi.ai/v1/videos/<id>/content -H "Authorization: Bearer $CHINAAPI_KEY"
```

视频请求记得带 `resolution`：不带时网关会按最高档预扣额度，余额少的用户会被拒。

Claude Code / Cursor / Cline：Base URL 设成 `https://api.chinaapi.ai`，模型名填 `text`。

**固定版本**：`text@2026-10` 现在指向当前模型。以后把 `text` 换成新模型时，在 new-api 里把旧模型留成一个单独的名字（比如 `text-2026-10`），再在 web 服务的环境变量里写 `MODEL_PINS='{"text@2026-10":"text-2026-10"}'`。

## 五、文件说明

```
docker-compose.yml          一键启动全部服务
Caddyfile                   三个域名的 HTTPS 和转发
.env.example                配置模板
scripts/init-newapi.mjs     一键配置 new-api（渠道、价格、品牌、赠送额度、套餐、试用 Key）
web/
  server.mjs                页面、Studio 后端、对外 API 入口、控制台账号接口转发（无第三方依赖）
  lib/agent.mjs             Agent 逻辑：DeepSeek 决策，调用出图 / 出视频
  lib/gateway.mjs           调用 new-api
  lib/mock.mjs              演示模式
  public/index.html         首页
  public/pricing.html       定价
  public/playground.html    Playground
  public/studio.html        Studio
  public/console.html       控制台
  public/assets/site.css    五个页面共用的样式
  public/assets/site.js     共用逻辑：登录状态、账号接口、演示账号
  public/assets/brand/      三家 logo 和我们的 logo（来源见 SOURCES.md）
  dev/mock-upstream.mjs     假的 DeepSeek + BytePlus，不花钱测试整条链路
  dev/make-samples.py       生成演示用的示例图片和视频
```

## 六、上线前要确认的事

1. **new-api 是 AGPL-3.0 协议**：我们只改配置、不改源码，并且通过它的接口对接，没问题。admin 后台页脚的署名和链接要保留；控制台页脚也写了"账号和计费基于 New API"。如果以后要改它的代码，修改部分需要公开。
2. **三家 logo** 来源记录在 `web/public/assets/brand/SOURCES.md`，使用以你们拿到的品牌授权为准。
3. **"数据不出中国"**：DeepSeek 走官方 API 时数据会到 DeepSeek 的服务器。要兑现网站上这句话，文字渠道应换成海外托管的 DeepSeek 开源权重（Fireworks、Together、DeepInfra，或自己的 GPU 跑 vLLM），在 new-api 里加一个 OpenAI 兼容渠道、模型名同样叫 `text` 即可。BytePlus 的数据处理地区请跟 BytePlus 书面确认。
4. **价格和套餐**：价格按官方价起步，上线前用真实上游成本和一周的测试账单再算一遍。套餐卡片上写的"优先路由、更高限速、发票"需要运营上兑现，做不到就改文案。
5. **美国政府和承包商**：DeepSeek 已被美国联邦民用机构禁用，服务条款里写明不向美国政府及其承包商提供服务。
6. **注册防刷**：可以在 admin 后台开邮箱验证（先在后台填好 SMTP 发信设置），控制台会自动多出"邮箱 + 验证码"，这一项测过。也可以开 Cloudflare Turnstile 人机验证，控制台已经接好，但需要 Cloudflare 账号，没有实测。
