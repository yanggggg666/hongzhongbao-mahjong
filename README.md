# 红中宝麻将（局域网联机）

基于 **Expo (React Native)** 的跨平台麻将游戏，一套代码同时编译 **Android** 和 **iOS**，通过 **WiFi 局域网**近距离联机（UDP 广播发现主机 + TCP 传输游戏数据），支持 **1-4 人**联机，**2-3 人**时可自定义电脑玩家人数。

## 功能

- 标准红中宝规则：108 张序数牌（万/条/筒）+ 4 张红中（万能牌）
- 吃 / 碰 / 明杠 / 暗杠 / 补杠 / 抢杠胡
- 自摸、点炮、一炮多响、七对、对对胡、清一色、杠上开花
- 流局判定、庄家轮换、计分
- AI 电脑玩家（自动摸打、吃碰杠胡）
- 局域网联机：UDP 广播自动发现主机，也支持手动输入 IP
- 房主托管游戏逻辑，其他设备实时同步；玩家掉线自动转为 AI

## 快速开始

```bash
npm install
npx expo prebuild --platform android   # 或 ios，生成原生工程
npm start                               # 启动开发服务器
```

> 注意：本机需安装 [Expo Go](https://expo.dev/client) 或使用 `npx expo run:android` / `npx expo run:ios` 运行。由于使用了 TCP/UDP 原生模块，**不能**直接用 Expo Go 扫码运行，请使用开发构建（development build）。

## GitHub Actions 编译

推送代码到 `main` 分支（或手动触发 `workflow_dispatch`）即可自动编译：

| 产物 | 说明 |
| --- | --- |
| `hongzhongbao-android-apk` | Android APK（Debug 签名，可直接安装） |
| `hongzhongbao-ios-simulator` | iOS 模拟器包（免签名，验证编译用） |
| `hongzhongbao-ios-ipa` | iOS 真机 IPA（需配置签名密钥后自动启用） |

### iOS 真机签名配置（可选）

在仓库 Settings → Secrets and variables → Actions 中添加：

- `APPLE_CERTIFICATE`：.p12 证书的 Base64
- `APPLE_CERTIFICATE_PASSWORD`：证书密码
- `APPLE_ISSUER_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY`：App Store Connect API Key
- `APPLE_TEAM_ID`：开发者团队 ID

配置后 `ios-device` 任务会自动运行并产出可上架的 IPA。

### Android 正式签名（可选）

默认产出 Debug 签名 APK。如需正式发布，将 `android/app/debug.keystore` 替换为自己的 keystore，或在 `android/app/build.gradle` 中配置 `signingConfigs.release`。

## 联机玩法

1. 所有设备连接**同一个 WiFi**
2. 一台设备点「创建房间」，设置电脑人数后开始游戏
3. 其他设备点「加入房间」，会自动搜索到主机（也可手动输入主机 IP）
4. 房主点击「开始游戏」，所有人同步进入牌局

## 项目结构

```
src/
├── game/            # 纯 TypeScript 游戏核心（与平台无关）
│   ├── types.ts     # 类型定义
│   ├── tiles.ts     # 牌墙构建、洗牌、排序
│   ├── rules.ts     # 胡牌判定（红中作万能牌）、七对、计番
│   ├── engine.ts    # 游戏状态机：发牌、摸打、吃碰杠胡、抢杠、计分
│   └── ai.ts        # 电脑玩家决策
├── network/
│   ├── protocol.ts  # 通信协议（JSON 消息）
│   └── room.ts      # 联机房间：TCP 主机/客户端 + UDP 发现 + AI 调度
├── screens/         # 界面：主页 / 大厅 / 牌局
└── components/      # 牌面组件
```

## 规则说明

- 红中为万能牌，可代替任何牌组成顺子、刻子、将牌；3 张红中可组成刻子
- 胡牌型：标准 4 面子 + 1 将，或七对
- 计分：平胡 1 分起，每张红中 +1，自摸 +1，杠上开花 +1，抢杠 +1；七对 / 对对胡 / 清一色翻倍
- 自摸：其余每家付分；点炮：放炮者付分
